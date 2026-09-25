import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { invoiceState, money } from "@/lib/money";
import { serializable } from "@/lib/tx";

const schema = z.object({
  invoiceId: z.string(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  method: z.string().trim().min(1).max(60),
  reference: z.string().trim().max(120).optional(),
});

class PaymentError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function handlePOST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  const user = await authorize("finance.payments.write");
  const amount = money(p.data.amount);

  try {
    // The balance check and the insert run in one serializable transaction so two
    // simultaneous payments cannot together exceed the invoice total.
    const result = await serializable(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: p.data.invoiceId }, include: { payments: { where: { reversedAt: null } } } });
      if (!invoice || invoice.voidedAt) throw new PaymentError("Invoice not found", 404);
      const before = invoice.payments.reduce((s, x) => s.plus(x.amount), money(0));
      const after = before.plus(amount);
      if (after.gt(invoice.total)) throw new PaymentError("Payment exceeds remaining balance", 409);
      const state = invoiceState(invoice.total, after);

      const payment = await tx.payment.create({ data: { invoiceId: invoice.id, amount, paidAt: new Date(), method: p.data.method, reference: p.data.reference, recordedById: user.id } });
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: state.status } });
      await tx.financialTransaction.create({ data: { type: "PAYMENT", amount, invoiceId: invoice.id, createdById: user.id } });
      await tx.auditLog.create({ data: { userId: user.id, action: "PAYMENT_RECORDED", entityType: "Invoice", entityId: invoice.id, previousValue: { paid: before.toString() }, newValue: { paid: after.toString(), remaining: state.remaining.toString(), status: state.status } } });
      return { payment: { ...payment, amount: payment.amount.toString() }, status: state.status, remaining: state.remaining.toString() };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export const POST = api(handlePOST);
