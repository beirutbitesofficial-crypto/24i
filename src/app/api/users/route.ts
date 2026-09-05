import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const roleKeys = ["ADMIN","MANAGER","EDITOR","SOCIAL_MEDIA_MANAGER","CLIENT"] as const;
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  roleKey: z.enum(roleKeys),
  clientIds: z.array(z.string()).default([]),
});

export async function GET() {
  const actor = await authorize("users.read");
  const users = await db.user.findMany({
    include: {
      role: true,
      clientUsers: { include: { client: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: u.status,
    language: u.language,
    role: { key: u.role.key, name: u.role.name },
    clients: u.clientUsers.map((x) => ({ id: x.client.id, brandName: x.client.brandName })),
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    canEdit: actor.role.key === "ADMIN" || u.role.key !== "ADMIN",
  })));
}

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const actor = await authorize("users.write");
  const data = parsed.data;
  if (actor.role.key !== "ADMIN" && data.roleKey === "ADMIN") {
    return NextResponse.json({ error: "Only Admin can create another Admin" }, { status: 403 });
  }

  const role = await db.role.findUnique({ where: { key: data.roleKey } });
  if (!role) return NextResponse.json({ error: "Role not found" }, { status: 400 });

  const email = data.email.trim().toLowerCase();
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const passwordHash = await hashPassword(data.password);
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash,
        roleId: role.id,
        status: "ACTIVE",
        clientUsers: data.clientIds.length
          ? { create: [...new Set(data.clientIds)].map((clientId) => ({ clientId })) }
          : undefined,
      },
      include: { role: true, clientUsers: { include: { client: true } } },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "USER_CREATED",
        entityType: "User",
        entityId: created.id,
        newValue: { name: created.name, email: created.email, role: role.key, clientIds: data.clientIds },
      },
    });
    return created;
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    role: { key: user.role.key, name: user.role.name },
    clients: user.clientUsers.map((x) => ({ id: x.client.id, brandName: x.client.brandName })),
  }, { status: 201 });
}
