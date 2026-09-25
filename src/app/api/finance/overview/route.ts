import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

// Parses ?from / ?to. A date-only `to` (YYYY-MM-DD) includes the whole day.
function parseRange(url: URL) {
  const now = new Date();
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toRaw ? new Date(toRaw) : now;
  if (toRaw && /^\d{4}-\d{2}-\d{2}$/.test(toRaw)) to.setUTCHours(23, 59, 59, 999);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  return { from, to };
}

async function handleGET(req: Request) {
  await authorize("finance.read");
  const range = parseRange(new URL(req.url));
  if (!range) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  const { from, to } = range;

  const [transactions, billedAgg, openInvoices] = await Promise.all([
    db.financialTransaction.findMany({ where: { createdAt: { gte: from, lte: to }, type: { in: ["PAYMENT", "EXPENSE", "SALARY"] } } }),
    db.invoice.aggregate({ where: { issuedAt: { gte: from, lte: to }, voidedAt: null }, _sum: { total: true } }),
    // Outstanding is the real open balance today, independent of the reporting window.
    db.invoice.findMany({ where: { voidedAt: null, status: { not: "PAID" } }, include: { payments: { where: { reversedAt: null } } } }),
  ]);

  const total = (type: string) => transactions.filter((x) => x.type === type).reduce((s, x) => s.plus(x.amount), money(0));
  const collected = total("PAYMENT");
  const expenses = total("EXPENSE").abs();
  const salaries = total("SALARY").abs();
  const billed = billedAgg._sum.total || money(0);
  const outstanding = openInvoices.reduce((s, inv) => s.plus(inv.total).minus(inv.payments.reduce((p, x) => p.plus(x.amount), money(0))), money(0));

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    billed: billed.toString(),
    collected: collected.toString(),
    outstanding: outstanding.toString(),
    expenses: expenses.toString(),
    salaries: salaries.toString(),
    netProfit: collected.minus(expenses).minus(salaries).toString(),
  });
}

export const GET = api(handleGET);
