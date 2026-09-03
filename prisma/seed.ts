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
          .map((x) => x[0] + x.slice(1).toLowerCase())
          .join(" "),
      },
    });
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email) throw new Error("Set ADMIN_EMAIL for the initial admin");
  if (!password || password.length < 8) {
    throw new Error("Set ADMIN_PASSWORD with at least 8 characters");
  }

  const admin = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
  const passwordHash = await argon2.hash(password);

  await db.user.upsert({
    where: { email },
    update: {
      name: "24i Admin",
      passwordHash,
      roleId: admin.id,
      status: "ACTIVE",
    },
    create: {
      name: "24i Admin",
      email,
      passwordHash,
      roleId: admin.id,
      status: "ACTIVE",
    },
  });

  console.log(`24i admin ready: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
