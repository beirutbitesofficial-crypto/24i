import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";

const input = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const DEFAULT_ADMIN_EMAIL = "admin@24iproduction.com";
const DEFAULT_ADMIN_PASSWORD = "23002300";
const BOOTSTRAP_SETTING_KEY = "default_admin_bootstrap_used";

export async function POST(req: Request) {
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

  const matchesDefaultAdmin =
    email === DEFAULT_ADMIN_EMAIL && password === DEFAULT_ADMIN_PASSWORD;

  if (!valid && matchesDefaultAdmin) {
    const bootstrapSetting = await db.setting.findUnique({
      where: { key: BOOTSTRAP_SETTING_KEY },
    });
    const bootstrapAlreadyUsed = bootstrapSetting?.value === true;

    if (!bootstrapAlreadyUsed) {
      const adminRole = await db.role.upsert({
        where: { key: "ADMIN" },
        update: { name: "Admin" },
        create: { key: "ADMIN", name: "Admin" },
      });

      const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
      user = await db.user.upsert({
        where: { email: DEFAULT_ADMIN_EMAIL },
        update: {
          name: "24i Admin",
          passwordHash,
          roleId: adminRole.id,
          status: "ACTIVE",
        },
        create: {
          name: "24i Admin",
          email: DEFAULT_ADMIN_EMAIL,
          passwordHash,
          roleId: adminRole.id,
          status: "ACTIVE",
        },
      });

      await db.setting.upsert({
        where: { key: BOOTSTRAP_SETTING_KEY },
        update: { value: true },
        create: { key: BOOTSTRAP_SETTING_KEY, value: true },
      });

      valid = true;
      console.log(`24i default admin bootstrap completed: ${DEFAULT_ADMIN_EMAIL}`);
    }
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
