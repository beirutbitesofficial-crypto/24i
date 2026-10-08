import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMeetingTables } from "@/lib/db-upgrades";
import { MEETING_ROLES, clientWhatsAppLink, notifyClientOnWhatsApp } from "@/lib/meetings";

const schema = z.object({ action: z.enum(["confirm", "decline"]), note: z.string().trim().max(1000).optional() });

// Manager decision on a website meeting request. The client is messaged on WhatsApp when the
// Cloud API is configured; otherwise the response carries a prefilled wa.me link to send by hand.
async function handlePATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!MEETING_ROLES.includes(user.role.key)) return NextResponse.json({ error: "Only Admin or Manager can confirm meetings" }, { status: 403 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await ensureMeetingTables();
  const { id } = await ctx.params;
  const meeting = await db.meetingRequest.findUnique({ where: { id } });
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

  const status = parsed.data.action === "confirm" ? "CONFIRMED" : "DECLINED";
  if (meeting.status === status) return NextResponse.json({ error: `Already ${status.toLowerCase()}` }, { status: 409 });
  if (status === "CONFIRMED") {
    const clash = await db.meetingRequest.findFirst({ where: { id: { not: id }, date: meeting.date, time: meeting.time, status: "CONFIRMED" }, select: { name: true } });
    if (clash) return NextResponse.json({ error: `Another meeting (${clash.name}) is already confirmed at this time.` }, { status: 409 });
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.meetingRequest.update({
      where: { id },
      data: { status, decidedAt: new Date(), decidedById: user.id, decidedByName: user.name, managerNote: parsed.data.note || null },
    });
    await tx.auditLog.create({
      data: { userId: user.id, action: `MEETING_${status}`, entityType: "MeetingRequest", entityId: id, previousValue: { status: meeting.status }, newValue: { status } },
    });
    return row;
  });

  const whatsappSent = await notifyClientOnWhatsApp(updated, status);
  if (whatsappSent) await db.meetingRequest.update({ where: { id }, data: { clientNotifiedAt: new Date() } });

  return NextResponse.json({ status, whatsappSent, waLink: clientWhatsAppLink(updated, status) });
}

export const PATCH = api(handlePATCH);
