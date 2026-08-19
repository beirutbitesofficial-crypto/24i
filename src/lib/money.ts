import { Prisma } from "@prisma/client";
export const money = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value).toDecimalPlaces(2);
export function invoiceState(total: Prisma.Decimal.Value, paid: Prisma.Decimal.Value) {
  const t = money(total), p = money(paid), remaining = Prisma.Decimal.max(t.minus(p), 0);
  return { paid: p, remaining, status: remaining.eq(0) ? "PAID" : p.gt(0) ? "PARTIALLY_PAID" : "UNPAID" } as const;
}
