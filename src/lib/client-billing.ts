import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { invoiceState, money } from "./money";

// The agency's standard monthly packages. They are created on first use and can be edited
// or extended from Finance afterwards; existing packages with the same name are left alone.
export const DEFAULT_PACKAGES = [
  { name: "Basic", price: "300", entitlements: { reels: 5, posts: 5 } },
  { name: "Standard", price: "500", entitlements: { reels: 10, posts: 10 } },
  { name: "Premium", price: "700", entitlements: { reels: 12, posts: 14 } },
];

let packagesReady: Promise<void> | null = null;

export function ensureDefaultPackages() {
  packagesReady ??= (async () => {
    const existing = new Set((await db.package.findMany({ select: { name: true } })).map((p) => p.name.toLowerCase()));
    for (const p of DEFAULT_PACKAGES) {
      if (existing.has(p.name.toLowerCase())) continue;
      await db.package.create({ data: { name: p.name, price: money(p.price), interval: "MONTHLY", entitlements: p.entitlements, active: true } });
    }
  })().catch((error) => {
    packagesReady = null;
    throw error;
  });
  return packagesReady;
}

export type PackageOption = { id: string; name: string; price: string; reels: number; posts: number };

export async function packageOptions(): Promise<PackageOption[]> {
  await ensureDefaultPackages();
  const rows = await db.package.findMany({ where: { active: true }, orderBy: { price: "asc" } });
  return rows.map((p) => {
    const e = (p.entitlements || {}) as { reels?: unknown; posts?: unknown };
    return { id: p.id, name: p.name, price: p.price.toFixed(0), reels: Number(e.reels) || 0, posts: Number(e.posts) || 0 };
  });
}

const monthLabel = (d: Date) => d.toLocaleDateString("en", { month: "long", year: "numeric" });

// Puts a client on a package: closes the current package, opens the new one and issues this
// month's invoice. When `paid` is true the invoice is settled in full right away.
export async function assignClientPackage(
  tx: Prisma.TransactionClient,
  { clientId, packageId, paid, actorId, method = "Cash" }: { clientId: string; packageId: string; paid: boolean; actorId: string; method?: string },
) {
  const pkg = await tx.package.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) throw new BillingError("Package not found", 404);
  const now = new Date();

  await tx.clientPackage.updateMany({ where: { clientId, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, data: { endsAt: now } });
  const assigned = await tx.clientPackage.create({ data: { clientId, packageId: pkg.id, startsAt: now, price: pkg.price, usage: {} } });

  const number = `INV-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const invoice = await tx.invoice.create({
    data: {
      clientId,
      number,
      total: pkg.price,
      dueDate: now,
      status: paid ? "PAID" : "UNPAID",
      revenueItems: { create: { description: `${pkg.name} package · ${monthLabel(now)}`, amount: pkg.price, kind: "SERVICE" } },
    },
  });
  await tx.financialTransaction.create({ data: { type: "INVOICE", amount: pkg.price, invoiceId: invoice.id, createdById: actorId } });
  if (paid) await recordFullPayment(tx, invoice.id, pkg.price, actorId, method);

  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: "CLIENT_PACKAGE_ASSIGNED",
      entityType: "ClientPackage",
      entityId: assigned.id,
      newValue: { clientId, package: pkg.name, price: pkg.price.toString(), invoice: number, paid },
    },
  });
  return { assigned, invoice };
}

async function recordFullPayment(tx: Prisma.TransactionClient, invoiceId: string, amount: Prisma.Decimal, actorId: string, method: string) {
  await tx.payment.create({ data: { invoiceId, amount, paidAt: new Date(), method, recordedById: actorId } });
  await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
  await tx.financialTransaction.create({ data: { type: "PAYMENT", amount, invoiceId, createdById: actorId } });
}

// Settles whatever is still owed on the client's open invoices.
export async function markClientPaid(tx: Prisma.TransactionClient, clientId: string, actorId: string, method = "Cash") {
  const invoices = await tx.invoice.findMany({
    where: { clientId, voidedAt: null, status: { not: "PAID" } },
    include: { payments: { where: { reversedAt: null } } },
  });
  if (!invoices.length) throw new BillingError("Nothing is due for this client", 409);
  let total = money(0);
  for (const invoice of invoices) {
    const paid = invoice.payments.reduce((s, p) => s.plus(p.amount), money(0));
    const { remaining } = invoiceState(invoice.total, paid);
    if (remaining.gt(0)) await recordFullPayment(tx, invoice.id, remaining, actorId, method);
    else await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
    total = total.plus(remaining);
  }
  await tx.auditLog.create({ data: { userId: actorId, action: "PAYMENT_RECORDED", entityType: "Client", entityId: clientId, newValue: { settled: total.toString(), invoices: invoices.map((i) => i.number) } } });
  return total;
}

export class BillingError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export type BillingSummary = {
  packageName: string | null;
  reels: number;
  posts: number;
  price: string | null;
  status: "PAID" | "PARTIALLY_PAID" | "UNPAID" | null;
  due: string;
};

// Current package and payment state for each client, for the Clients table.
export async function billingSummaries(clientIds: string[]) {
  const now = new Date();
  const [packages, invoices] = await Promise.all([
    db.clientPackage.findMany({
      where: { clientId: { in: clientIds }, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      include: { package: true },
      orderBy: { startsAt: "desc" },
    }),
    db.invoice.findMany({ where: { clientId: { in: clientIds }, voidedAt: null }, include: { payments: { where: { reversedAt: null } } } }),
  ]);
  const result = new Map<string, BillingSummary>();
  for (const id of clientIds) {
    const current = packages.find((p) => p.clientId === id);
    const e = (current?.package.entitlements || {}) as { reels?: unknown; posts?: unknown };
    const mine = invoices.filter((i) => i.clientId === id);
    let due = money(0);
    let partlyPaid = false;
    for (const i of mine) {
      const { remaining } = invoiceState(i.total, i.payments.reduce((s, p) => s.plus(p.amount), money(0)));
      due = due.plus(remaining);
      if (remaining.gt(0) && i.payments.length > 0) partlyPaid = true;
    }
    result.set(id, {
      packageName: current?.package.name ?? null,
      reels: Number(e.reels) || 0,
      posts: Number(e.posts) || 0,
      price: current ? current.price.toFixed(0) : null,
      status: !mine.length ? null : due.eq(0) ? "PAID" : partlyPaid ? "PARTIALLY_PAID" : "UNPAID",
      due: due.toFixed(2),
    });
  }
  return result;
}
