import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { checkFiles } from "@/lib/scope";
import { serializable } from "@/lib/tx";

const schema = z.object({
  fileId: z.string().optional(),
  thumbnailId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  slides: z.array(z.object({ fileId: z.string(), position: z.number().int().min(0) })).max(20).optional(),
});

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const content = await db.contentItem.findUnique({ where: { id }, include: { client: { include: { users: true } } } });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const u = await authorize("content.upload", content.clientId);
  if (u.role.key === "EDITOR" && content.ownerId !== u.id) {
    return NextResponse.json({ error: "Editors can upload only content assigned to them" }, { status: 403 });
  }

  const slides = p.data.slides ?? [];
  if (content.type === "CAROUSEL" && !slides.length) return NextResponse.json({ error: "Carousel slides are required" }, { status: 400 });
  if (content.type !== "CAROUSEL" && !p.data.fileId) return NextResponse.json({ error: "A file is required" }, { status: 400 });
  const positions = slides.map((x) => x.position);
  if (new Set(positions).size !== positions.length) return NextResponse.json({ error: "Slide positions must be unique" }, { status: 400 });
  const invalid = await checkFiles([p.data.fileId, p.data.thumbnailId, ...slides.map((s) => s.fileId)], content.clientId);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const version = await serializable(async (tx) => {
    const latest = await tx.contentVersion.findFirst({ where: { contentId: id }, orderBy: { version: "desc" }, select: { version: true } });
    const v = await tx.contentVersion.create({
      data: {
        contentId: id,
        version: (latest?.version ?? 0) + 1,
        fileId: p.data.fileId,
        thumbnailId: p.data.thumbnailId,
        notes: p.data.notes,
        uploadedById: u.id,
        slides: slides.length ? { create: slides } : undefined,
      },
    });
    await tx.contentItem.update({ where: { id }, data: { status: "WAITING_CLIENT_APPROVAL", visualStatus: "WAITING" } });
    await tx.approval.create({ data: { contentId: id, contentVersionId: v.id, reviewerId: u.id, state: "WAITING", scope: "VISUAL" } });
    await tx.auditLog.create({ data: { userId: u.id, action: "CONTENT_VERSION_SUBMITTED", entityType: "ContentItem", entityId: id, newValue: { version: v.version } } });
    return v;
  });

  await notify(content.client.users.map((x) => x.userId), {
    kind: "APPROVAL",
    title: version.version === 1 ? "New content ready" : "Revised content ready",
    body: `${content.title} V${version.version} is ready for approval.`,
    deepLink: `/content/${id}`,
  });
  return NextResponse.json(version, { status: 201 });
}

export const POST = api(handlePOST);
