import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const allPermissions = new Set([
  "dashboard.read","users.read","users.write","roles.read","roles.manage","clients.read","clients.write","projects.read","projects.write","tasks.read","tasks.write","tasks.update","content.read","content.write","content.upload","content.approve","content.schedule","calendar.read","calendar.write","files.read","files.write","notifications.read","packages.read","packages.write","finance.read","finance.client.read","finance.invoices.write","finance.payments.write","finance.expenses.write","finance.salaries.write","finance.reports.read","audit.read","settings.read","settings.write"
]);

const schema = z.object({ permissions: z.array(z.string()).max(100) });

export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const actor = await requireUser();
  if (actor.role.key !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { key } = await params;
  if (key === "ADMIN") return NextResponse.json({ error: "Admin is always unrestricted" }, { status: 409 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.permissions.some((p) => !allPermissions.has(p))) return NextResponse.json({ error: "Unknown permission" }, { status: 400 });
  const role = await db.role.findUnique({ where: { key } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 404 });
  const unique = [...new Set(parsed.data.permissions)];
  await db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (unique.length) await tx.rolePermission.createMany({ data: unique.map((permission) => ({ roleId: role.id, permission })) });
    await tx.auditLog.create({ data: { userId: actor.id, action: "ROLE_PERMISSIONS_UPDATED", entityType: "Role", entityId: role.id, newValue: { key: role.key, permissions: unique } } });
  });
  return NextResponse.json({ ok: true, permissions: unique });
}
