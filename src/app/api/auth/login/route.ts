import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";

const input = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const parsed = input.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;
  const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envAdminPassword = process.env.ADMIN_PASSWORD;

  let user = await db.user.findUnique({ where: { email } });
  let valid = Boolean(
    user &&
      user.status === "ACTIVE" &&
      (await verifyPassword(user.passwordHash, password))
  );

  // Recovery path for production deployments: if the submitted credentials match
  // the server-side ADMIN_EMAIL / ADMIN_PASSWORD values, repair or create the admin
  // account in the database and continue login. The password itself is never stored
  // in plaintext; only an Argon2id hash is persisted.
  const matchesEnvAdmin = Boolean(
    envAdminEmail &&
      envAdminPassword &&
      email === envAdminEmail &&
      password === envAdminPassword
  );

  if (!valid && matchesEnvAdmin) {
    const adminRole = await db.role.upsert({
      where: { key: "ADMIN" },
      update: { name: "Admin" },
      create: { key: "ADMIN", name: "Admin" },
    });

    const passwordHash = await hashPassword(password);
    user = await db.user.upsert({
      where: { email },
      update: {
        name: "24i Admin",
        passwordHash,
        roleId: adminRole.id,
        status: "ACTIVE",
      },
      create: {
        name: "24i Admin",
        email,
        passwordHash,
        roleId: adminRole.id,
        status: "ACTIVE",
      },
    });
    valid = true;
    console.log(`24i admin credentials repaired from environment: ${email}`);
  }

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
