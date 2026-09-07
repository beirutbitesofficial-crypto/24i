import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { deleteStoredObject } from "@/lib/storage";

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
      versions: { include: { slides: true }, orderBy: { version: "desc" }, take: 1 },
      captions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await authorize("content.approve", content.clientId);
  const state = parsed.data.decision;
  const currentVersion = content.versions[0];

  if (user.role.key === "CLIENT") {
    if (parsed.data.scope !== "ALL") {
      return NextResponse.json({ error: "Client approval must include visual and caption together" }, { status: 400 });
    }
    if (content.status !== "WAITING_CLIENT_APPROVAL" || !currentVersion || !content.captions[0]) {
      return NextResponse.json({ error: "This content package is not ready for client approval" }, { status: 409 });
    }
  }

  const result = await db.$transaction(async (tx) => {
    const approval = await tx.approval.create({
      data: {
        contentId: content.id,
        contentVersionId: parsed.data.scope !== "CAPTION" ? currentVersion?.id : null,
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

  let socialManagers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      role: { key: "SOCIAL_MEDIA_MANAGER" },
      clientUsers: { some: { clientId: content.clientId } },
    },
    select: { id: true },
  });
  if (!socialManagers.length) {
    socialManagers = await db.user.findMany({
      where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" } },
      select: { id: true },
    });
  }

  const managers = await db.user.findMany({
    where: { status: "ACTIVE", role: { key: "MANAGER" } },
    select: { id: true },
  });

  const recipients = [...new Set([
    currentVersion?.uploadedById,
    content.captions[0]?.createdById,
    content.ownerId,
    ...socialManagers.map((x) => x.id),
    ...managers.map((x) => x.id),
  ].filter((recipientId): recipientId is string => !!recipientId && recipientId !== user.id))];

  if (recipients.length) {
    await notify(recipients, {
      kind: state === "APPROVED" ? "APPROVAL" : "REVISION",
      title: state === "APPROVED" ? "Content approved by client" : "Client requested changes",
      body: state === "APPROVED"
        ? `${content.client.brandName} approved ${content.title} — visual + caption.`
        : `${content.client.brandName} requested changes on ${content.title}: ${parsed.data.note}`,
      deepLink: `/content/${content.id}`,
    });
  }

  // Client-reviewed media is temporary. Keep the decision, captions, notes and
  // production metadata, but remove the heavy media from object storage once
  // the client has approved it or sent revision notes.
  if (user.role.key === "CLIENT" && parsed.data.scope === "ALL" && currentVersion) {
    const assetIds = [...new Set([
      currentVersion.fileId,
      currentVersion.thumbnailId,
      ...currentVersion.slides.map((slide) => slide.fileId),
    ].filter((fileId): fileId is string => !!fileId))];

    if (assetIds.length) {
      const files = await db.fileObject.findMany({
        where: { id: { in: assetIds }, deletedAt: null },
        select: { id: true, key: true },
      });

      const cleanupResults = await Promise.allSettled(
        files.map(async (file) => {
          await deleteStoredObject(file.key);
          return file.id;
        })
      );

      const deletedIds = cleanupResults.flatMap((item) =>
        item.status === "fulfilled" ? [item.value] : []
      );
      const failedCount = cleanupResults.length - deletedIds.length;

      if (deletedIds.length) {
        await db.fileObject.updateMany({
          where: { id: { in: deletedIds } },
          data: { deletedAt: new Date() },
        });
      }

      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "CONTENT_MEDIA_PURGED_AFTER_REVIEW",
          entityType: "ContentItem",
          entityId: content.id,
          newValue: {
            version: currentVersion.version,
            decision: state,
            deletedFiles: deletedIds.length,
            failedFiles: failedCount,
          },
        },
      });
    }
  }

  return NextResponse.json(result, { status: 201 });
}
