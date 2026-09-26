import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { deleteStoredObject } from "@/lib/storage";
import { publishApprovedContent } from "@/lib/publishing";
import { publicBaseUrl } from "@/lib/public-media";

const schema = z.object({
  contentId: z.string(),
  scope: z.enum(["VISUAL", "CAPTION", "ALL"]),
  decision: z.enum(["APPROVED", "REVISION_REQUESTED"]),
  note: z.string().trim().max(2000).optional(),
  slideId: z.string().optional(),
}).refine((v) => v.decision === "APPROVED" || !!v.note, { message: "Revision note is required", path: ["note"] });

async function handlePOST(req: Request) {
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
  const coversVisual = parsed.data.scope !== "CAPTION";
  const coversCaption = parsed.data.scope !== "VISUAL";

  // Nothing can be approved before it has been submitted.
  if (coversVisual && !currentVersion) return NextResponse.json({ error: "No visual version has been submitted yet" }, { status: 409 });
  if (coversCaption && !content.captions[0]) return NextResponse.json({ error: "No caption has been submitted yet" }, { status: 409 });
  if (parsed.data.slideId && !currentVersion?.slides.some((slide) => slide.id === parsed.data.slideId)) {
    return NextResponse.json({ error: "Slide does not belong to the latest version" }, { status: 400 });
  }

  if (user.role.key === "CLIENT") {
    // Clients approve the whole package at once, but may ask for changes to just the
    // video/design (VISUAL), just the caption/hashtags (CAPTION), or both (ALL).
    if (state === "APPROVED" && parsed.data.scope !== "ALL") {
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
    // Close the pending review requests this decision answers.
    await tx.approval.updateMany({
      // A client decision answers the whole package that was sent to them.
      where: { contentId: content.id, state: "WAITING", id: { not: approval.id }, ...(user.role.key === "CLIENT" || parsed.data.scope === "ALL" ? {} : { scope: parsed.data.scope }) },
      data: { state, decidedAt: new Date() },
    });
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

  // Route the note to whoever has to act on it: video/design changes go to the editor,
  // caption/hashtag changes go to the Social Media Manager. Managers always see it.
  const editors = [currentVersion?.uploadedById, content.ownerId];
  const copywriters = [content.captions[0]?.createdById, ...socialManagers.map((x) => x.id)];
  const targets = state === "APPROVED"
    ? [...editors, ...copywriters]
    : parsed.data.scope === "VISUAL" ? [...editors, ...socialManagers.map((x) => x.id)]
    : parsed.data.scope === "CAPTION" ? copywriters
    : [...editors, ...copywriters];
  const recipients = [...new Set([...targets, ...managers.map((x) => x.id)]
    .filter((recipientId): recipientId is string => !!recipientId && recipientId !== user.id))];

  const what = parsed.data.scope === "VISUAL" ? "the video/design" : parsed.data.scope === "CAPTION" ? "the caption/hashtags" : "the video and the caption";
  if (recipients.length) {
    await notify(recipients, {
      kind: state === "APPROVED" ? "APPROVAL" : "REVISION",
      title: state === "APPROVED"
        ? "Content approved by client"
        : parsed.data.scope === "VISUAL" ? "Client wants changes to the video" : parsed.data.scope === "CAPTION" ? "Client wants changes to the caption" : "Client requested changes",
      body: state === "APPROVED"
        ? `${content.client.brandName} approved ${content.title} — visual + caption.`
        : `${content.client.brandName} wants changes to ${what} on ${content.title}: ${parsed.data.note}`,
      deepLink: `/content/${content.id}`,
    });
  }

  if (user.role.key === "CLIENT" && parsed.data.scope === "ALL" && state === "APPROVED") {
    try {
      const publishing = await publishApprovedContent(content.id, publicBaseUrl(req));
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "AUTO_PUBLISH_TRIGGERED",
          entityType: "ContentItem",
          entityId: content.id,
          newValue: publishing,
        },
      });
    } catch (error) {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "AUTO_PUBLISH_TRIGGER_FAILED",
          entityType: "ContentItem",
          entityId: content.id,
          newValue: { error: error instanceof Error ? error.message : "Unknown publishing error" },
        },
      });
    }
  }

  // Rejected media is temporary and can be purged immediately after the
  // client sends revision notes. Approved media must remain available for
  // scheduling/publishing and is cleaned up only after publishing.
  if (
    user.role.key === "CLIENT" &&
    // The video is only replaced when the change is about the video; caption-only feedback keeps it.
    parsed.data.scope !== "CAPTION" &&
    state === "REVISION_REQUESTED" &&
    currentVersion
  ) {
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
          action: "CONTENT_REJECTED_MEDIA_PURGED",
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

export const POST = api(handlePOST);
