import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password || password.length < 8) {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD are not configured; skipping admin sync.");
  } else {
    const adminRole = await db.role.upsert({
      where: { key: "ADMIN" },
      update: { name: "Admin" },
      create: { key: "ADMIN", name: "Admin" },
    });

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await db.user.upsert({
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

    console.log(`24i admin synchronized: ${email}`);
  }
} catch (error) {
  console.error("Failed to synchronize 24i admin:", error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
