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
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id: parsed.data.contentId },
    include: {
      client: { include: { users: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      captions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await authorize("content.approve", content.clientId);
  const state = parsed.data.decision;

  // External clients always approve/reject the complete package: latest visual + latest caption.
  if (user.role.key === "CLIENT") {
    if (parsed.data.scope !== "ALL") {
      return NextResponse.json({ error: "Client approval must include visual and caption together" }, { status: 400 });
    }
    if (content.status !== "WAITING_CLIENT_APPROVAL" || !content.versions[0] || !content.captions[0]) {
      return NextResponse.json({ error: "This content package is not ready for client approval" }, { status: 409 });
    }
  }

  const result = await db.$transaction(async (tx) => {
    const approval = await tx.approval.create({
      data: {
        contentId: content.id,
        contentVersionId: parsed.data.scope !== "CAPTION" ? content.versions[0]?.id : null,
        captionVersionId: parsed.data.scope !== "VISUAL" ? content.captions[0]?.id : null,
        reviewerId: user.id,
        scope: parsed.data.scope,
        state,
        decidedAt: new Date(),
        notes: parsed.data.note
          ? { create: { authorId: user.id, body: parsed.data.note, slideId: parsed.data.slideId } }
          : undefined,
      },
    });

    const update: any = {};
    if (parsed.data.scope !== "CAPTION") update.visualStatus = state;
    if (parsed.data.scope !== "VISUAL") update.captionStatus = state;

    if (state === "REVISION_REQUESTED") {
      update.status = "REVISION_REQUESTED";
    } else if (parsed.data.scope === "ALL") {
      update.status = "APPROVED";
    } else if (parsed.data.scope === "VISUAL" && ["APPROVED", "NOT_REQUIRED"].includes(content.captionStatus)) {
      update.status = "APPROVED";
    } else if (parsed.data.scope === "CAPTION" && ["APPROVED", "NOT_REQUIRED"].includes(content.visualStatus)) {
      update.status = "APPROVED";
    } else if (parsed.data.scope === "CAPTION") {
      update.status = "CAPTION_APPROVED";
    }

    await tx.contentItem.update({ where: { id: content.id }, data: update });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: `CONTENT_${state}`,
        entityType: "ContentItem",
        entityId: content.id,
        newValue: parsed.data,
      },
    });
    return approval;
  });

  const socialManagers = await db.user.findMany({
    where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" } },
    select: { id: true },
  });
  const recipients = [...new Set([
    content.versions[0]?.uploadedById,
    content.captions[0]?.createdById,
    content.ownerId,
    ...socialManagers.map((x) => x.id),
  ].filter((id): id is string => !!id && id !== user.id))];

  if (recipients.length) {
    await notify(recipients, {
      kind: state === "APPROVED" ? "APPROVAL" : "REVISION",
      title: state === "APPROVED" ? "Content package approved" : "Client requested changes",
      body: state === "APPROVED"
        ? `${content.client.brandName} approved the visual and caption for ${content.title}.`
        : `${content.client.brandName} requested changes on ${content.title}: ${parsed.data.note}`,
      deepLink: `/content/${content.id}`,
    });
  }

  return NextResponse.json(result, { status: 201 });
}
