import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { publishApprovedContent } from "@/lib/publishing";
import { publicBaseUrl } from "@/lib/public-media";
import { serializable } from "@/lib/tx";

const schema = z.object({
  caption: z.string().trim().min(1).max(10000),
  hashtags: z.string().trim().max(3000).optional(),
  cta: z.string().trim().max(1000).optional(),
});

// The client fixes the caption themselves and approves the whole package in one step.
async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "The caption cannot be empty" }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id },
    include: {
      client: { select: { brandName: true } },
      versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, uploadedById: true } },
      captions: { orderBy: { version: "desc" }, take: 1, select: { createdById: true } },
    },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await authorize("content.approve", content.clientId);
  if (user.role.key !== "CLIENT") return NextResponse.json({ error: "Only the client can use this" }, { status: 403 });
  if (content.status !== "WAITING_CLIENT_APPROVAL" || !content.versions[0] || !content.captions[0]) {
    return NextResponse.json({ error: "This content is not waiting for your approval" }, { status: 409 });
  }

  const caption = await serializable(async (tx) => {
    const latest = await tx.captionVersion.findFirst({ where: { contentId: id }, orderBy: { version: "desc" }, select: { version: true } });
    const row = await tx.captionVersion.create({
      data: { contentId: id, version: (latest?.version ?? 0) + 1, caption: parsed.data.caption, hashtags: parsed.data.hashtags || null, cta: parsed.data.cta || null, createdById: user.id },
    });
    await tx.approval.updateMany({ where: { contentId: id, state: "WAITING" }, data: { state: "APPROVED", decidedAt: new Date() } });
    await tx.approval.create({
      data: { contentId: id, contentVersionId: content.versions[0].id, captionVersionId: row.id, reviewerId: user.id, scope: "ALL", state: "APPROVED", decidedAt: new Date(), notes: { create: { authorId: user.id, body: "Client edited the caption and approved." } } },
    });
    await tx.contentItem.update({ where: { id }, data: { visualStatus: "APPROVED", captionStatus: "APPROVED", status: "APPROVED" } });
    await tx.auditLog.create({ data: { userId: user.id, action: "CLIENT_EDITED_CAPTION_AND_APPROVED", entityType: "ContentItem", entityId: id, newValue: { captionVersion: row.version } } });
    return row;
  });

  const [socialManagers, managers] = await Promise.all([
    db.user.findMany({ where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" }, clientUsers: { some: { clientId: content.clientId } } }, select: { id: true } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { key: "MANAGER" } }, select: { id: true } }),
  ]);
  const recipients = [...new Set([content.captions[0].createdById, content.versions[0].uploadedById, content.ownerId, ...socialManagers.map((x) => x.id), ...managers.map((x) => x.id)]
    .filter((r): r is string => !!r && r !== user.id))];
  if (recipients.length) {
    await notify(recipients, {
      kind: "APPROVAL",
      title: "Client edited the caption and approved",
      body: `${content.client.brandName} updated the caption of ${content.title} and approved it.`,
      deepLink: `/content/${id}`,
    });
  }

  let publishing: unknown = null;
  try {
    publishing = await publishApprovedContent(id, publicBaseUrl(req));
    await db.auditLog.create({ data: { userId: user.id, action: "AUTO_PUBLISH_TRIGGERED", entityType: "ContentItem", entityId: id, newValue: publishing as object } });
  } catch (error) {
    await db.auditLog.create({ data: { userId: user.id, action: "AUTO_PUBLISH_TRIGGER_FAILED", entityType: "ContentItem", entityId: id, newValue: { error: error instanceof Error ? error.message : "Unknown publishing error" } } });
  }
  return NextResponse.json({ ok: true, captionVersion: caption.version, publishing }, { status: 201 });
}

export const POST = api(handlePOST);
