import { randomBytes } from "node:crypto";
import { z } from "zod";
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

const amount = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount such as 250 or 250.50");

// What the forms send: a listed package or a custom one, plus how much was paid.
export const billingInput = z.object({
  packageId: z.string().min(1).optional(),
  custom: z.object({
    reels: z.coerce.number().int().min(0).max(1000),
    posts: z.coerce.number().int().min(0).max(1000),
    price: amount.refine((v) => Number(v) > 0, "Price must be greater than zero"),
  }).optional(),
  payment: z.enum(["UNPAID", "PAID", "PARTIAL"]).default("UNPAID"),
  amount: amount.optional(),
});
export type BillingInput = z.infer<typeof billingInput>;

export const wantsPackage = (b: Partial<BillingInput>) => Boolean(b.packageId || b.custom);

const monthLabel = (d: Date) => d.toLocaleDateString("en", { month: "long", year: "numeric" });

const isPackageLine = (description: string) => / package · /.test(description);

// Puts a client on a package and makes sure this month has exactly one package invoice.
// - First package this month: the current package is closed, the new one opens and this
//   month's invoice is issued.
// - Already billed this month (e.g. fixing a wrong choice): the package and this month's
//   invoice are corrected in place. Extra package invoices from this month are cancelled and
//   their payments moved onto the one that stays, so nothing is billed twice.
// Payment: "PAID" settles the invoice, "PARTIAL" means the client has paid `amount` in total
// for this month, "UNPAID" leaves recorded payments as they are.
// A custom package is saved as its own hidden package so it never shows up in the lists.
export async function assignClientPackage(
  tx: Prisma.TransactionClient,
  { clientId, billing, actorId, method = "Cash" }: { clientId: string; billing: BillingInput; actorId: string; method?: string },
) {
  const pkg = billing.custom
    ? await tx.package.create({ data: { name: "Custom", price: money(billing.custom.price), interval: "MONTHLY", entitlements: { reels: billing.custom.reels, posts: billing.custom.posts }, active: false } })
    : billing.packageId ? await tx.package.findUnique({ where: { id: billing.packageId } }) : null;
  if (!pkg || (!billing.custom && !pkg.active)) throw new BillingError("Package not found", 404);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const description = `${pkg.name} package · ${monthLabel(now)}`;

  const thisMonth = (await tx.invoice.findMany({
    where: { clientId, voidedAt: null, issuedAt: { gte: monthStart } },
    include: { revenueItems: true, payments: { where: { reversedAt: null } } },
    orderBy: { issuedAt: "desc" },
  })).filter((inv) => inv.revenueItems.some((r) => isPackageLine(r.description)));

  let invoice: { id: string; number: string };
  let assignedId: string;
  let corrected = false;

  if (thisMonth.length) {
    corrected = true;
    const [keep, ...extra] = thisMonth;
    const paidSoFar = thisMonth.reduce((sum, inv) => sum.plus(inv.payments.reduce((s2, p) => s2.plus(p.amount), money(0))), money(0));
    if (paidSoFar.gt(pkg.price)) throw new BillingError(`The client already paid $${paidSoFar.toFixed(2)} this month, more than the new price ($${pkg.price.toFixed(2)}).`, 409);

    for (const inv of extra) {
      await tx.payment.updateMany({ where: { invoiceId: inv.id }, data: { invoiceId: keep.id } });
      await tx.financialTransaction.updateMany({ where: { invoiceId: inv.id, type: "PAYMENT" }, data: { invoiceId: keep.id } });
      await tx.invoice.update({ where: { id: inv.id }, data: { voidedAt: now } });
      await tx.financialTransaction.create({ data: { type: "REVERSAL", amount: inv.total.negated(), invoiceId: inv.id, createdById: actorId, metadata: { reason: "Duplicate package invoice cancelled", mergedInto: keep.number } } });
    }
    const packageLines = keep.revenueItems.filter((r) => isPackageLine(r.description));
    const others = keep.revenueItems.filter((r) => !isPackageLine(r.description)).reduce((sum, r) => sum.plus(r.amount), money(0));
    await tx.revenueItem.deleteMany({ where: { id: { in: packageLines.map((r) => r.id) } } });
    await tx.revenueItem.create({ data: { invoiceId: keep.id, description, amount: pkg.price, kind: "SERVICE" } });
    const total = others.plus(pkg.price);
    if (!total.eq(keep.total)) {
      await tx.financialTransaction.create({ data: { type: "INVOICE", amount: total.minus(keep.total), invoiceId: keep.id, createdById: actorId, metadata: { adjustment: true, reason: "Package changed" } } });
    }
    await tx.invoice.update({ where: { id: keep.id }, data: { total, status: invoiceState(total, paidSoFar).status } });
    invoice = keep;

    const current = await tx.clientPackage.findFirst({ where: { clientId, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { startsAt: "desc" } });
    if (current) {
      await tx.clientPackage.update({ where: { id: current.id }, data: { packageId: pkg.id, price: pkg.price } });
      await tx.clientPackage.updateMany({ where: { clientId, id: { not: current.id }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, data: { endsAt: now } });
      assignedId = current.id;
    } else {
      assignedId = (await tx.clientPackage.create({ data: { clientId, packageId: pkg.id, startsAt: now, price: pkg.price, usage: {} } })).id;
    }
  } else {
    await tx.clientPackage.updateMany({ where: { clientId, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, data: { endsAt: now } });
    assignedId = (await tx.clientPackage.create({ data: { clientId, packageId: pkg.id, startsAt: now, price: pkg.price, usage: {} } })).id;
    const number = `INV-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
    invoice = await tx.invoice.create({
      data: { clientId, number, total: pkg.price, dueDate: now, status: "UNPAID", revenueItems: { create: { description, amount: pkg.price, kind: "SERVICE" } } },
    });
    await tx.financialTransaction.create({ data: { type: "INVOICE", amount: pkg.price, invoiceId: invoice.id, createdById: actorId } });
  }

  // Bring what is recorded as paid for this month's invoice up to what the user said.
  const fresh = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: { where: { reversedAt: null } } } });
  const alreadyPaid = fresh.payments.reduce((sum, p) => sum.plus(p.amount), money(0));
  const target = billing.payment === "PAID" ? fresh.total : billing.payment === "PARTIAL" ? money(billing.amount || "0") : alreadyPaid;
  if (billing.payment === "PARTIAL" && (target.lte(0) || target.gte(fresh.total))) throw new BillingError(`A partial payment must be more than 0 and less than $${fresh.total.toFixed(0)}`, 400);
  if (target.lt(alreadyPaid)) throw new BillingError(`$${alreadyPaid.toFixed(2)} is already recorded as paid for this month. Enter at least that amount.`, 409);
  const extraPayment = target.minus(alreadyPaid);
  if (extraPayment.gt(0)) await recordPayment(tx, fresh.id, extraPayment, invoiceState(fresh.total, target).status === "PAID" ? "PAID" : "PARTIALLY_PAID", actorId, method);

  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: corrected ? "CLIENT_PACKAGE_CORRECTED" : "CLIENT_PACKAGE_ASSIGNED",
      entityType: "ClientPackage",
      entityId: assignedId,
      newValue: { clientId, package: pkg.name, price: pkg.price.toString(), invoice: invoice.number, payment: billing.payment, paidThisMonth: target.toString(), cancelledInvoices: corrected ? thisMonth.slice(1).map((x) => x.number) : [] },
    },
  });
  return { invoice };
}

async function recordPayment(tx: Prisma.TransactionClient, invoiceId: string, amount: Prisma.Decimal, status: "PAID" | "PARTIALLY_PAID", actorId: string, method: string) {
  await tx.payment.create({ data: { invoiceId, amount, paidAt: new Date(), method, recordedById: actorId } });
  await tx.invoice.update({ where: { id: invoiceId }, data: { status } });
  await tx.financialTransaction.create({ data: { type: "PAYMENT", amount, invoiceId, createdById: actorId } });
}

// Records a payment from the client, oldest open invoice first. Without an amount it
// settles everything that is due.
export async function recordClientPayment(tx: Prisma.TransactionClient, clientId: string, actorId: string, amountText?: string, method = "Cash") {
  const invoices = await tx.invoice.findMany({
    where: { clientId, voidedAt: null, status: { not: "PAID" } },
    include: { payments: { where: { reversedAt: null } } },
    orderBy: { issuedAt: "asc" },
  });
  const open = invoices.map((invoice) => ({ invoice, ...invoiceState(invoice.total, invoice.payments.reduce((s, p) => s.plus(p.amount), money(0))) }));
  const due = open.reduce((s, x) => s.plus(x.remaining), money(0));
  if (due.eq(0)) throw new BillingError("Nothing is due for this client", 409);
  let left = amountText ? money(amountText) : due;
  if (left.lte(0)) throw new BillingError("Enter an amount greater than zero", 400);
  if (left.gt(due)) throw new BillingError(`That is more than the $${due.toFixed(2)} due`, 409);

  const settled = left;
  for (const x of open) {
    if (left.lte(0)) break;
    if (x.remaining.eq(0)) { await tx.invoice.update({ where: { id: x.invoice.id }, data: { status: "PAID" } }); continue; }
    const part = left.gte(x.remaining) ? x.remaining : left;
    await recordPayment(tx, x.invoice.id, part, part.eq(x.remaining) ? "PAID" : "PARTIALLY_PAID", actorId, method);
    left = left.minus(part);
  }
  await tx.auditLog.create({ data: { userId: actorId, action: "PAYMENT_RECORDED", entityType: "Client", entityId: clientId, newValue: { amount: settled.toString(), dueBefore: due.toString() } } });
  return settled;
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
