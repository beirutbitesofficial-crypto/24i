import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

// Non-negative amounts only: a negative deduction must never be able to raise a salary.
const amount = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimals");
const schema = z.object({
  profileId: z.string(),
  bonus: amount.default("0"),
  deduction: amount.default("0"),
  advance: amount.default("0"),
  paymentDate: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

async function handlePOST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  const u = await authorize("finance.salaries.write");
  const profile = await db.salaryProfile.findUnique({ where: { id: p.data.profileId } });
  if (!profile || !profile.active) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const bonus = money(p.data.bonus), deduction = money(p.data.deduction), advance = money(p.data.advance);
  const final = profile.baseSalary.plus(bonus).minus(deduction).minus(advance);
  if (final.isNegative()) return NextResponse.json({ error: "Final amount cannot be negative" }, { status: 400 });

  const row = await db.$transaction(async (tx) => {
    const s = await tx.salaryPayment.create({ data: { profileId: profile.id, base: profile.baseSalary, bonus, deduction, advance, finalAmount: final, paymentDate: p.data.paymentDate, notes: p.data.notes } });
    await tx.financialTransaction.create({ data: { type: "SALARY", amount: final.negated(), salaryPaymentId: s.id, createdById: u.id } });
    await tx.auditLog.create({ data: { userId: u.id, action: "SALARY_PAID", entityType: "SalaryPayment", entityId: s.id, newValue: { finalAmount: final.toString(), paymentDate: p.data.paymentDate.toISOString() } } });
    return s;
  });
  return NextResponse.json(row, { status: 201 });
}

export const POST = api(handlePOST);
