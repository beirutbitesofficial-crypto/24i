import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const db = new PrismaClient();

const rolePermissions: Record<string, string[]> = {
  ADMIN: [],
  MANAGER: [
    "dashboard.read","users.read","users.write","clients.read","clients.write","projects.read","projects.write","tasks.read","tasks.write","tasks.update","content.read","content.write","content.upload","content.approve","content.schedule","calendar.read","calendar.write","files.read","files.write","notifications.read","packages.read","packages.write","finance.read","finance.invoices.write","finance.payments.write","finance.expenses.write","finance.salaries.write","finance.reports.read","audit.read",
  ],
  EDITOR: [
    "dashboard.read","projects.read","tasks.read","tasks.update","content.read","content.upload","calendar.read","files.read","files.write","notifications.read",
  ],
  SOCIAL_MEDIA_MANAGER: [
    "dashboard.read","clients.read","projects.read","tasks.read","tasks.write","tasks.update","content.read","content.write","content.upload","content.approve","content.schedule","calendar.read","calendar.write","files.read","files.write","notifications.read",
  ],
  CLIENT: [
    "dashboard.read","clients.read","content.read","content.approve","calendar.read","files.read","notifications.read","packages.read","finance.client.read",
  ],
};

async function main() {
  for (const key of Object.keys(rolePermissions)) {
    const role = await db.role.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: key.split("_").map((x) => x[0] + x.slice(1).toLowerCase()).join(" "),
      },
    });
    if (key !== "ADMIN") {
      await db.rolePermission.deleteMany({ where: { roleId: role.id } });
      await db.rolePermission.createMany({ data: rolePermissions[key].map((permission) => ({ roleId: role.id, permission })) });
    }
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email) throw new Error("Set ADMIN_EMAIL for the initial admin");
  if (!password || password.length < 8) throw new Error("Set ADMIN_PASSWORD with at least 8 characters");

  const admin = await db.role.findUniqueOrThrow({ where: { key: "ADMIN" } });
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.user.upsert({
    where: { email },
    update: { name: "24i Admin", passwordHash, roleId: admin.id, status: "ACTIVE" },
    create: { name: "24i Admin", email, passwordHash, roleId: admin.id, status: "ACTIVE" },
  });
  console.log(`24i roles, permissions and admin ready: ${email}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
