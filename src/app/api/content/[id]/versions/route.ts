import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  fileId: z.string().optional(),
  thumbnailId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  slides: z.array(z.object({ fileId: z.string(), position: z.number().int().min(0) })).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await authorize("content.upload", content.clientId);
  if (user.role.key === "EDITOR" && content.ownerId !== user.id) {
    return NextResponse.json({ error: "Editors can upload only content assigned to them" }, { status: 403 });
  }

  if (content.type === "CAROUSEL" && !parsed.data.slides?.length) {
    return NextResponse.json({ error: "Carousel slides are required" }, { status: 400 });
  }
  if (content.type !== "CAROUSEL" && !parsed.data.fileId) {
    return NextResponse.json({ error: "A visual file is required" }, { status: 400 });
  }

  const positions = parsed.data.slides?.map((x) => x.position) || [];
  if (new Set(positions).size !== positions.length) {
    return NextResponse.json({ error: "Slide positions must be unique" }, { status: 400 });
  }

  const version = await db.$transaction(async (tx) => {
    const row = await tx.contentVersion.create({
      data: {
        contentId: id,
        version: (content.versions[0]?.version || 0) + 1,
        fileId: parsed.data.fileId,
        thumbnailId: parsed.data.thumbnailId,
        notes: parsed.data.notes,
        uploadedById: user.id,
        slides: parsed.data.slides ? { create: parsed.data.slides } : undefined,
      },
    });

    // Internal handoff: the visual is uploaded, but the client should not review
    // until the social media manager adds/submits the caption.
    await tx.contentItem.update({
      where: { id },
      data: { status: "UPLOAD", visualStatus: "DRAFT", captionStatus: "DRAFT" },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CONTENT_VERSION_UPLOADED_FOR_COPY",
        entityType: "ContentItem",
        entityId: id,
        newValue: { version: row.version },
      },
    });
    return row;
  });

  const socialManagers = await db.user.findMany({
    where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" } },
    select: { id: true },
  });
  const recipients = [...new Set(socialManagers.map((x) => x.id).filter((id) => id !== user.id))];
  if (recipients.length) {
    await notify(recipients, {
      kind: "APPROVAL",
      title: "Visual ready for caption",
      body: `${content.title} V${version.version} was uploaded. Add the caption and send the full content to the client.`,
      deepLink: `/content/${id}`,
    });
  }

  return NextResponse.json(version, { status: 201 });
}
