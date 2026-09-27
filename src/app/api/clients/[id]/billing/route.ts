import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/http";
import { AuthError, authorize, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { assignClientPackage, BillingError, markClientPaid } from "@/lib/client-billing";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), packageId: z.string().min(1), paid: z.boolean().default(false) }),
  z.object({ action: z.literal("markPaid") }),
]);

async function handlePOST(req: Request, { params }: Ctx) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id } = await params;
  const needsPayment = parsed.data.action === "markPaid" || parsed.data.paid;
  const user = await authorize(parsed.data.action === "assign" ? "packages.write" : "finance.payments.write");
  if (parsed.data.action === "assign" && !hasPermission(user, "finance.invoices.write")) throw new AuthError(403);
  if (needsPayment && !hasPermission(user, "finance.payments.write")) throw new AuthError(403);

  const client = await db.client.findUnique({ where: { id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const data = parsed.data;
    await db.$transaction(async (tx) => {
      if (data.action === "assign") await assignClientPackage(tx, { clientId: id, packageId: data.packageId, paid: data.paid, actorId: user.id });
      else await markClientPaid(tx, id, user.id);
    });
  } catch (error) {
    if (error instanceof BillingError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
  return NextResponse.json({ ok: true });
}

export const POST = api(handlePOST);
