import { db } from "./db";

// Partner (co-owner) role: sees the work and the money, but cannot change anything.
// Created on first use so existing databases get it without a migration or reseed.
export const PARTNER_PERMISSIONS = [
  "dashboard.read", "clients.read", "projects.read", "tasks.read", "content.read",
  "calendar.read", "files.read", "notifications.read", "packages.read",
  "finance.read", "finance.reports.read",
];

let partnerReady: Promise<void> | null = null;

export function ensurePartnerRole() {
  partnerReady ??= (async () => {
    const existing = await db.role.findUnique({ where: { key: "PARTNER" } });
    if (existing) return;
    await db.role.create({
      data: { key: "PARTNER", name: "Partner", permissions: { create: PARTNER_PERMISSIONS.map((permission) => ({ permission })) } },
    });
  })().catch((error) => {
    partnerReady = null;
    throw error;
  });
  return partnerReady;
}
