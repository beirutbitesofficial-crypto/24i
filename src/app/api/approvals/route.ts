import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  contentId: z.string(),
  scope: z.enum(["VISUAL", "CAPTION", "ALL"]),
  decision: z.enum(["APPROVED", "REVISION_REQUESTED"]),
  note: z.string().trim().max(2000).optional(),
  slideId: z.string().optional(),
}).refine((v) => v.decision === "APPROVED" || !!v.note, { message: "Revision note is required" });

export async function POST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id: p.data.contentId },
    include: {
      client: { include: { users: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      captions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await authorize("content.approve", content.clientId);
  const state = p.data.decision;

  const result = await db.$transaction(async (tx) => {
    const approval = await tx.approval.create({
      data: {
        contentId: content.id,
        contentVersionId: p.data.scope !== "CAPTION" ? content.versions[0]?.id : null,
        captionVersionId: p.data.scope !== "VISUAL" ? content.captions[0]?.id : null,
        reviewerId: user.id,
        scope: p.data.scope,
        state,
        decidedAt: new Date(),
        notes: p.data.note ? { create: { authorId: user.id, body: p.data.note, slideId: p.data.slideId } } : undefined,
      },
    });

    const update: any = {};
    if (p.data.scope !== "CAPTION") update.visualStatus = state;
    if (p.data.scope !== "VISUAL") update.captionStatus = state;

    if (state === "REVISION_REQUESTED") {
      update.status = "REVISION_REQUESTED";
    } else if (p.data.scope === "ALL") {
      update.status = "APPROVED";
    } else if (p.data.scope === "VISUAL" && ["APPROVED", "NOT_REQUIRED"].includes(content.captionStatus)) {
      update.status = "APPROVED";
    } else if (p.data.scope === "CAPTION" && ["APPROVED", "NOT_REQUIRED"].includes(content.visualStatus)) {
      update.status = "APPROVED";
    } else if (p.data.scope === "CAPTION") {
      update.status = "CAPTION_APPROVED";
    }

    await tx.contentItem.update({ where: { id: content.id }, data: update });
    await tx.auditLog.create({ data: { userId: user.id, action: `CONTENT_${state}`, entityType: "ContentItem", entityId: content.id, newValue: p.data } });
    return approval;
  });

  const socialManagers = await db.user.findMany({
    where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" } },
    select: { id: true },
  });
  const recipients = [...new Set([
    content.versions[0]?.uploadedById,
    content.ownerId,
    ...socialManagers.map((x) => x.id),
  ].filter((id): id is string => !!id && id !== user.id))];

  if (recipients.length) {
    await notify(recipients, {
      kind: state === "APPROVED" ? "APPROVAL" : "REVISION",
      title: state === "APPROVED" ? "Content approved" : "Revision requested",
      body: state === "APPROVED"
        ? `${content.client.brandName} approved ${content.title}.`
        : `${content.client.brandName} requested changes on ${content.title}: ${p.data.note}`,
      deepLink: `/content/${content.id}`,
    });
  }

  return NextResponse.json(result, { status: 201 });
}
