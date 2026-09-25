import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ApprovalState, Prisma } from "@prisma/client";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z
  .object({
    contentId: z.string(),
    scope: z.enum(["VISUAL", "CAPTION", "ALL"]),
    decision: z.enum(["APPROVED", "REVISION_REQUESTED"]),
    note: z.string().trim().max(2000).optional(),
    slideId: z.string().optional(),
  })
  .refine((v) => v.decision === "APPROVED" || !!v.note, { message: "Revision note is required", path: ["note"] });

const done = (s: ApprovalState) => s === "APPROVED" || s === "NOT_REQUIRED";

async function handlePOST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id: p.data.contentId },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1, include: { slides: { select: { id: true } } } },
      captions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await authorize("content.approve", content.clientId);

  const { scope, decision: state, note, slideId } = p.data;
  const visual = scope !== "CAPTION";
  const caption = scope !== "VISUAL";
  const latestVersion = content.versions[0];
  const latestCaption = content.captions[0];

  // Nothing can be approved before it has been submitted.
  if (visual && !latestVersion) return NextResponse.json({ error: "No visual version has been submitted yet" }, { status: 409 });
  if (caption && !latestCaption) return NextResponse.json({ error: "No caption has been submitted yet" }, { status: 409 });
  if (slideId && !latestVersion?.slides.some((s) => s.id === slideId)) {
    return NextResponse.json({ error: "Slide does not belong to the latest version" }, { status: 400 });
  }

  const visualStatus = visual ? state : content.visualStatus;
  const captionStatus = caption ? state : content.captionStatus;
  const status =
    visualStatus === "REVISION_REQUESTED" || captionStatus === "REVISION_REQUESTED"
      ? "REVISION_REQUESTED"
      : done(visualStatus) && done(captionStatus)
        ? "READY_TO_SCHEDULE"
        : visualStatus === "APPROVED" && captionStatus !== "WAITING"
          ? "APPROVED"
          : content.status;

  const result = await db.$transaction(async (tx) => {
    const approval = await tx.approval.create({
      data: {
        contentId: content.id,
        contentVersionId: visual ? latestVersion!.id : null,
        captionVersionId: caption ? latestCaption!.id : null,
        reviewerId: user.id,
        scope,
        state,
        decidedAt: new Date(),
        notes: note ? { create: { authorId: user.id, body: note, slideId } } : undefined,
      },
    });
    const data: Prisma.ContentItemUpdateInput = { visualStatus, captionStatus, status };
    await tx.contentItem.update({ where: { id: content.id }, data });
    // Close the pending review requests this decision answers.
    await tx.approval.updateMany({
      where: { contentId: content.id, state: "WAITING", scope: scope === "ALL" ? { in: ["VISUAL", "CAPTION"] } : scope },
      data: { state, decidedAt: new Date() },
    });
    await tx.auditLog.create({ data: { userId: user.id, action: `CONTENT_${state}`, entityType: "ContentItem", entityId: content.id, newValue: p.data } });
    return approval;
  });
  return NextResponse.json(result, { status: 201 });
}

export const POST = api(handlePOST);
