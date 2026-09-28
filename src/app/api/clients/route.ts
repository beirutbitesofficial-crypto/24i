import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, assignedClientIds, hasPermission } from "@/lib/auth";
import { assignClientPackage, billingInput, BillingError, wantsPackage } from "@/lib/client-billing";
import { db } from "@/lib/db";

const schema = z.object({
  brandName: z.string().trim().min(1).max(160),
  industry: z.string().trim().max(120).optional(),
  contactName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  email: z.string().email(),
  website: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(200).optional(),
  facebook: z.string().trim().max(200).optional(),
  tiktok: z.string().trim().max(200).optional(),
  startDate: z.coerce.date().optional(),
  contractEndDate: z.coerce.date().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  status: z.enum(["LEAD","ACTIVE","PAUSED","PENDING_PAYMENT","CONTRACT_ENDING","INACTIVE"]).default("LEAD"),
  notes: z.string().max(5000).optional(),
  billing: billingInput.optional(),
});

async function handleGET() {
  const user = await authorize("clients.read");
  const ids = assignedClientIds(user);
  const rows = await db.client.findMany({ where: ids ? { id: { in: ids } } : {}, orderBy: { brandName: "asc" } });
  return NextResponse.json(rows);
}

async function handlePOST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const user = await authorize("clients.write");
  const { billing: rawBilling, ...data } = parsed.data;
  const billing = rawBilling && wantsPackage(rawBilling) ? rawBilling : null;
  if (billing && !(hasPermission(user, "packages.write") && hasPermission(user, "finance.invoices.write") && (billing.payment === "UNPAID" || hasPermission(user, "finance.payments.write")))) {
    return NextResponse.json({ error: "You are not allowed to set packages or payments" }, { status: 403 });
  }
  let row;
  try {
  row = await db.$transaction(async (tx) => {
    const client = await tx.client.create({ data });
    if (billing) await assignClientPackage(tx, { clientId: client.id, billing, actorId: user.id });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CLIENT_CREATED",
        entityType: "Client",
        entityId: client.id,
        newValue: {
          brandName: client.brandName,
          contactName: client.contactName,
          email: client.email,
          status: client.status,
          startDate: client.startDate?.toISOString() || null,
          contractEndDate: client.contractEndDate?.toISOString() || null,
        },
      },
    });
    return client;
  });
  } catch (error) {
    if (error instanceof BillingError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  return NextResponse.json(row, { status: 201 });
}

export const GET = api(handleGET);
export const POST = api(handlePOST);
