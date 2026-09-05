import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, assignedClientIds } from "@/lib/auth";
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
});

export async function GET() {
  const user = await authorize("clients.read");
  const ids = assignedClientIds(user);
  const rows = await db.client.findMany({ where: ids ? { id: { in: ids } } : {}, orderBy: { brandName: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const user = await authorize("clients.write");
  const row = await db.$transaction(async (tx) => {
    const client = await tx.client.create({ data: parsed.data });
    await tx.auditLog.create({ data: { userId: user.id, action: "CLIENT_CREATED", entityType: "Client", entityId: client.id, newValue: parsed.data } });
    return client;
  });
  return NextResponse.json(row, { status: 201 });
}
