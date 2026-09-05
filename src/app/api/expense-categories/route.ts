import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ name: z.string().trim().min(1).max(100) });
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const user = await authorize("finance.expenses.write");
  const row = await db.expenseCategory.upsert({ where: { name: parsed.data.name }, update: { active: true }, create: { name: parsed.data.name } });
  await db.auditLog.create({ data: { userId: user.id, action: "EXPENSE_CATEGORY_SAVED", entityType: "ExpenseCategory", entityId: row.id, newValue: { name: row.name } } });
  return NextResponse.json(row, { status: 201 });
}
