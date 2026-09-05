import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

const schema = z.object({ employeeId: z.string(), baseSalary: z.string().regex(/^\d+(\.\d{1,2})?$/) });
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const user = await authorize("finance.salaries.write");
  const employee = await db.user.findUnique({ where: { id: parsed.data.employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  const row = await db.salaryProfile.upsert({ where: { employeeId: employee.id }, update: { baseSalary: money(parsed.data.baseSalary), active: true }, create: { employeeId: employee.id, baseSalary: money(parsed.data.baseSalary), active: true } });
  await db.auditLog.create({ data: { userId: user.id, action: "SALARY_PROFILE_SAVED", entityType: "SalaryProfile", entityId: row.id, newValue: { employeeId: employee.id, baseSalary: row.baseSalary.toString() } } });
  return NextResponse.json({ ...row, baseSalary: row.baseSalary.toString() }, { status: 201 });
}
