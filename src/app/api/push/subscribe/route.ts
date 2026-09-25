import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

async function handlePOST(req: Request) {
  const u = await requireUser();
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  const data = { userId: u.id, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) };
  await db.pushSubscription.upsert({ where: { endpoint: p.data.endpoint }, create: { endpoint: p.data.endpoint, ...data }, update: data });
  return NextResponse.json({ ok: true });
}

export const POST = api(handlePOST);
