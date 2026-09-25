import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { checkClients } from "@/lib/scope";

const schema = z.object({
  description: z.string().trim().min(1).max(200),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  date: z.coerce.date(),
  categoryId: z.string(),
  vendor: z.string().trim().max(120).optional(),
  paymentMethod: z.string().trim().max(60).optional(),
  clientId: z.string().optional(),
  receiptKey: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});

async function handlePOST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  const u = await authorize("finance.expenses.write");
  const category = await db.expenseCategory.findUnique({ where: { id: p.data.categoryId } });
  if (!category || !category.active) return NextResponse.json({ error: "Expense category not found" }, { status: 400 });
  const invalid = await checkClients(p.data.clientId ? [p.data.clientId] : []);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (p.data.receiptKey && !(await db.fileObject.findFirst({ where: { key: p.data.receiptKey, deletedAt: null } }))) {
    return NextResponse.json({ error: "Receipt file not found" }, { status: 400 });
  }

  const amount = money(p.data.amount);
  const expense = await db.$transaction(async (tx) => {
    const e = await tx.expense.create({ data: { ...p.data, amount, createdById: u.id } });
    await tx.financialTransaction.create({ data: { type: "EXPENSE", amount: amount.negated(), expenseId: e.id, createdById: u.id } });
    await tx.auditLog.create({ data: { userId: u.id, action: "EXPENSE_CREATED", entityType: "Expense", entityId: e.id, newValue: { ...p.data, date: p.data.date.toISOString() } } });
    return e;
  });
  return NextResponse.json({ ...expense, amount: expense.amount.toString() }, { status: 201 });
}

export const POST = api(handlePOST);
