import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  caption: z.string().min(1).max(10000),
  hashtags: z.string().max(3000).optional(),
  cta: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          users: { include: { user: { include: { role: true } } } },
        },
      },
      versions: { orderBy: { version: "desc" }, take: 1 },
      captions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await authorize("content.write", content.clientId);
  if (!content.versions[0]) {
    return NextResponse.json({ error: "Upload the visual / reel / carousel first" }, { status: 400 });
  }

  const row = await db.$transaction(async (tx) => {
    const caption = await tx.captionVersion.create({
      data: {
        contentId: id,
        version: (content.captions[0]?.version || 0) + 1,
        caption: parsed.data.caption,
        hashtags: parsed.data.hashtags,
        cta: parsed.data.cta,
        createdById: user.id,
      },
    });

    await tx.contentItem.update({
      where: { id },
      data: {
        visualStatus: "WAITING",
        captionStatus: "WAITING",
        status: "WAITING_CLIENT_APPROVAL",
      },
    });

    await tx.approval.create({
      data: {
        contentId: id,
        contentVersionId: content.versions[0].id,
        captionVersionId: caption.id,
        reviewerId: user.id,
        state: "WAITING",
        scope: "ALL",
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CONTENT_PACKAGE_SENT_TO_CLIENT",
        entityType: "ContentItem",
        entityId: id,
        newValue: { visualVersion: content.versions[0].version, captionVersion: caption.version },
      },
    });
    return caption;
  });

  const clientUserIds = content.client.users
    .filter((x) => x.user.role.key === "CLIENT" && x.user.status === "ACTIVE")
    .map((x) => x.userId);

  if (clientUserIds.length) {
    await notify(clientUserIds, {
      kind: "APPROVAL",
      title: "Content ready for your approval",
      body: `${content.title} is ready. Review the visual and caption together, then approve or request changes.`,
      deepLink: `/content/${id}`,
    });
  }

  return NextResponse.json(row, { status: 201 });
}
