import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  companyName: z.string().trim().min(1).max(120),
  currency: z.literal("USD"),
  timezone: z.string().trim().min(1).max(80),
  defaultLanguage: z.enum(["EN", "AR"]),
});

export async function GET() {
  await authorize("settings.read");
  const row = await db.setting.findUnique({ where: { key: "agency_profile" } });
  return NextResponse.json(row?.value || { companyName: "24i Production", currency: "USD", timezone: "Asia/Beirut", defaultLanguage: "EN" });
}

export async function PATCH(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const user = await authorize("settings.write");
  const row = await db.setting.upsert({ where: { key: "agency_profile" }, update: { value: parsed.data }, create: { key: "agency_profile", value: parsed.data } });
  await db.auditLog.create({ data: { userId: user.id, action: "SETTINGS_UPDATED", entityType: "Setting", entityId: row.key, newValue: parsed.data } });
  return NextResponse.json({ ok: true, value: row.value });
}
