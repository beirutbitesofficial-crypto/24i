import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const roleKeys = ["ADMIN","MANAGER","EDITOR","SOCIAL_MEDIA_MANAGER","CLIENT"] as const;
const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  roleKey: z.enum(roleKeys).optional(),
  status: z.enum(["ACTIVE","DISABLED","PENDING"]).optional(),
  password: z.string().min(8).max(128).optional(),
  clientIds: z.array(z.string()).optional(),
  clientBrandName: z.string().trim().max(160).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const actor = await authorize("users.write");
  const target = await db.user.findUnique({ where: { id }, include: { role: true, clientUsers: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (actor.role.key !== "ADMIN" && (target.role.key === "ADMIN" || parsed.data.roleKey === "ADMIN")) {
    return NextResponse.json({ error: "Only Admin can modify Admin accounts" }, { status: 403 });
  }
  if (actor.id === target.id && parsed.data.status === "DISABLED") {
    return NextResponse.json({ error: "You cannot disable your own account" }, { status: 409 });
  }

  let roleId: string | undefined;
  if (parsed.data.roleKey) {
    const role = await db.role.findUnique({ where: { key: parsed.data.roleKey } });
    if (!role) return NextResponse.json({ error: "Role not found" }, { status: 400 });
    roleId = role.id;
  }

  const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : undefined;
  const before = {
    name: target.name,
    role: target.role.key,
    status: target.status,
    clientIds: target.clientUsers.map((x) => x.clientId),
  };
  const effectiveRole = parsed.data.roleKey ?? target.role.key;

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        roleId,
        status: parsed.data.status,
        passwordHash,
      },
    });

    if (parsed.data.clientIds) {
      await tx.clientUser.deleteMany({ where: { userId: id } });
      let unique = [...new Set(parsed.data.clientIds)];

      // CLIENT accounts must always stay linked to a Client record.
      if (effectiveRole === "CLIENT" && unique.length === 0) {
        if (target.clientUsers.length) {
          unique = target.clientUsers.map((x) => x.clientId);
        } else {
          const client = await tx.client.create({
            data: {
              brandName: parsed.data.clientBrandName?.trim() || parsed.data.name?.trim() || target.name,
              contactName: parsed.data.name?.trim() || target.name,
              email: target.email,
              status: "ACTIVE",
            },
          });
          unique = [client.id];
        }
      }

      if (unique.length) {
        await tx.clientUser.createMany({ data: unique.map((clientId) => ({ userId: id, clientId })) });
      }
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: id,
        previousValue: before,
        newValue: {
          name: parsed.data.name ?? target.name,
          role: effectiveRole,
          status: parsed.data.status ?? target.status,
          clientIds: parsed.data.clientIds ?? before.clientIds,
          passwordChanged: Boolean(parsed.data.password),
        },
      },
    });
    return user;
  });

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await authorize("users.write");
  const target = await db.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (actor.id === target.id) return NextResponse.json({ error: "You cannot disable your own account" }, { status: 409 });
  if (actor.role.key !== "ADMIN" && target.role.key === "ADMIN") {
    return NextResponse.json({ error: "Only Admin can modify Admin accounts" }, { status: 403 });
  }

  await db.$transaction([
    db.user.update({ where: { id }, data: { status: "DISABLED" } }),
    db.auditLog.create({ data: { userId: actor.id, action: "USER_DISABLED", entityType: "User", entityId: id } }),
  ]);
  return NextResponse.json({ ok: true });
}
