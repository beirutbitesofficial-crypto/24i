import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";

const input = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    const parsed = input.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    let user = await db.user.findUnique({ where: { email } });
    let valid = Boolean(
      user &&
        user.status === "ACTIVE" &&
        (await verifyPassword(user.passwordHash, password))
    );

    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const matchesEnvironmentAdmin =
      Boolean(adminEmail && adminPassword) &&
      email === adminEmail &&
      password === adminPassword;

    if (!valid && matchesEnvironmentAdmin) {
      const adminRole = await db.role.upsert({
        where: { key: "ADMIN" },
        update: { name: "Admin" },
        create: { key: "ADMIN", name: "Admin" },
      });

      const passwordHash = await hashPassword(adminPassword!);
      user = await db.user.upsert({
        where: { email: adminEmail! },
        update: {
          name: "24i Admin",
          passwordHash,
          roleId: adminRole.id,
          status: "ACTIVE",
        },
        create: {
          name: "24i Admin",
          email: adminEmail!,
          passwordHash,
          roleId: adminRole.id,
          status: "ACTIVE",
        },
      });
      valid = true;
    }

    if (!user || !valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login/database error:", error);
    return NextResponse.json(
      { error: "Database or server unavailable. Check DATABASE_URL and deployment logs." },
      { status: 503 }
    );
  }
}
