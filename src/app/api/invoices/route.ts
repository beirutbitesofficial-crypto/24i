import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { randomBytes } from "node:crypto";

const schema = z.object({
  clientId: z.string(),
  total: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) > 0, "Total must be greater than zero"),
  dueDate: z.coerce.date(),
  description: z.string().trim().min(1).max(500).default("Monthly service"),
});

async function handlePOST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const user = await authorize("finance.invoices.write");
  const client = await db.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const number = `INV-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const total = money(parsed.data.total);
  const invoice = await db.$transaction(async (tx) => {
    const row = await tx.invoice.create({
      data: {
        clientId: client.id,
        number,
        total,
        dueDate: parsed.data.dueDate,
        status: "UNPAID",
        revenueItems: { create: { description: parsed.data.description, amount: total, kind: "SERVICE" } },
      },
    });
    await tx.financialTransaction.create({ data: { type: "INVOICE", amount: total, invoiceId: row.id, createdById: user.id } });
    await tx.auditLog.create({ data: { userId: user.id, action: "INVOICE_CREATED", entityType: "Invoice", entityId: row.id, newValue: { number, clientId: client.id, total: total.toString(), dueDate: parsed.data.dueDate.toISOString() } } });
    return row;
  });
  return NextResponse.json({ ...invoice, total: invoice.total.toString() }, { status: 201 });
}

export const POST = api(handlePOST);
