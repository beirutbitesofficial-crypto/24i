import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishApprovedContent } from "@/lib/publishing";
import { publicBaseUrl } from "@/lib/public-media";

const schema = z.object({ scheduledAt: z.coerce.date() });

// Sets the date & time a content item should be published.
// - Not approved yet: the time is saved and used when the client approves.
// - Already approved and not yet sent to Buffer: it is sent to Buffer now, scheduled for that time.
// - Already sent to Buffer: the time must be changed in Buffer (we do not create duplicates).
async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = schema.safeParse(await req.json());
  if (!p.success || Number.isNaN(p.data.scheduledAt.getTime())) return NextResponse.json({ error: "A valid date is required" }, { status: 400 });
  if (p.data.scheduledAt.getTime() < Date.now() + 60_000) return NextResponse.json({ error: "Choose a time at least a few minutes in the future" }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id },
    include: { publishingAttempts: { where: { status: { in: ["SUBMITTED", "PUBLISHED"] } }, select: { id: true } } },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await authorize("content.schedule", content.clientId);
  if (content.publishingAttempts.length) {
    return NextResponse.json({ error: "This post was already sent to Buffer. Change its time in Buffer." }, { status: 409 });
  }

  const approved = content.visualStatus === "APPROVED" && ["APPROVED", "NOT_REQUIRED"].includes(content.captionStatus);
  const calendar = await db.$transaction(async (tx) => {
    const row = await tx.calendarEntry.upsert({
      where: { contentId: id },
      create: { contentId: id, scheduledAt: p.data.scheduledAt, publishingStatus: "SCHEDULED" },
      update: { scheduledAt: p.data.scheduledAt, publishingStatus: "SCHEDULED" },
    });
    await tx.contentItem.update({ where: { id }, data: { plannedAt: p.data.scheduledAt, ...(approved ? { status: "SCHEDULED" } : {}) } });
    await tx.auditLog.create({ data: { userId: user.id, action: "CONTENT_SCHEDULED", entityType: "ContentItem", entityId: id, newValue: { scheduledAt: p.data.scheduledAt.toISOString(), approved } } });
    return row;
  });

  let publishing: unknown = null;
  if (approved) {
    try {
      publishing = await publishApprovedContent(id, publicBaseUrl(req));
    } catch (error) {
      publishing = { error: error instanceof Error ? error.message : "Publishing failed" };
    }
  }
  return NextResponse.json({ calendar, approved, publishing });
}

export const POST = api(handlePOST);
