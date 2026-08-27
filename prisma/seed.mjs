import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

async function main() {
  const roles = ["ADMIN", "MANAGER", "EDITOR", "SOCIAL_MEDIA_MANAGER", "CLIENT"];

  for (const key of roles) {
    await db.role.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: key
          .split("_")
          .map((part) => part[0] + part.slice(1).toLowerCase())
          .join(" "),
      },
    });
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn("ADMIN_PASSWORD is not set; skipping initial admin seed.");
    return;
  }

  const adminRole = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
  const email = process.env.ADMIN_EMAIL || "admin@24i.local";

  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      name: "24i Admin",
      email,
      passwordHash: await argon2.hash(password),
      roleId: adminRole.id,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
