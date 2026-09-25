import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({ scheduledAt: z.coerce.date() });

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = schema.safeParse(await req.json());
  if (!p.success || Number.isNaN(p.data.scheduledAt.getTime())) return NextResponse.json({ error: "A valid date is required" }, { status: 400 });
  if (p.data.scheduledAt.getTime() < Date.now() - 60_000) return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });

  const c = await db.contentItem.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const u = await authorize("content.schedule", c.clientId);
  if (c.visualStatus !== "APPROVED" || !["APPROVED", "NOT_REQUIRED"].includes(c.captionStatus)) {
    return NextResponse.json({ error: "Visual and caption approvals are required" }, { status: 409 });
  }

  const result = await db.$transaction(async (tx) => {
    const calendar = await tx.calendarEntry.upsert({
      where: { contentId: id },
      create: { contentId: id, scheduledAt: p.data.scheduledAt },
      update: { scheduledAt: p.data.scheduledAt, publishingStatus: "SCHEDULED" },
    });
    await tx.contentItem.update({ where: { id }, data: { plannedAt: p.data.scheduledAt, status: "SCHEDULED" } });
    await tx.auditLog.create({ data: { userId: u.id, action: "CONTENT_SCHEDULED", entityType: "ContentItem", entityId: id, newValue: { scheduledAt: p.data.scheduledAt.toISOString() } } });
    return calendar;
  });
  return NextResponse.json(result);
}

export const POST = api(handlePOST);
