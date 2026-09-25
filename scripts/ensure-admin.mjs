import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

// Creates the bootstrap admin on first start. Existing passwords are never overwritten on
// restart unless ADMIN_RESET_PASSWORD=true is set explicitly (e.g. for account recovery).
try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const reset = process.env.ADMIN_RESET_PASSWORD === "true";

  if (!email || !password || password.length < 8) {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD are not configured; skipping admin sync.");
  } else if (!reset && (await db.user.findUnique({ where: { email } }))) {
    console.log(`24i admin already exists: ${email}`);
  } else {
    const adminRole = await db.role.upsert({
      where: { key: "ADMIN" },
      update: {},
      create: { key: "ADMIN", name: "Admin" },
    });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await db.user.upsert({
      where: { email },
      update: { passwordHash, roleId: adminRole.id, status: "ACTIVE" },
      create: { name: "24i Admin", email, passwordHash, roleId: adminRole.id, status: "ACTIVE" },
    });
    console.log(`24i admin ${reset ? "password reset" : "created"}: ${email}`);
  }
} catch (error) {
  console.error("Failed to synchronize 24i admin:", error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
