import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { serializable } from "@/lib/tx";

const schema = z.object({
  caption: z.string().min(1).max(10000),
  hashtags: z.string().max(3000).optional(),
  cta: z.string().max(1000).optional(),
});

async function handlePOST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const content = await db.contentItem.findUnique({
    where: { id },
    include: { client: { include: { users: true } } },
  });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await authorize("content.write", content.clientId);

  const row = await serializable(async (tx) => {
    const latest = await tx.captionVersion.findFirst({ where: { contentId: id }, orderBy: { version: "desc" }, select: { version: true } });
    const caption = await tx.captionVersion.create({
      data: {
        contentId: id,
        version: (latest?.version ?? 0) + 1,
        caption: parsed.data.caption,
        hashtags: parsed.data.hashtags,
        cta: parsed.data.cta,
        createdById: user.id,
      },
    });
    await tx.contentItem.update({ where: { id }, data: { captionStatus: "WAITING", status: "WAITING_CLIENT_APPROVAL" } });
    await tx.approval.create({ data: { contentId: id, captionVersionId: caption.id, reviewerId: user.id, state: "WAITING", scope: "CAPTION" } });
    await tx.auditLog.create({ data: { userId: user.id, action: "CAPTION_VERSION_SUBMITTED", entityType: "ContentItem", entityId: id, newValue: { version: caption.version } } });
    return caption;
  });

  await notify(content.client.users.map((x) => x.userId), { kind: "APPROVAL", title: "Caption ready", body: `${content.title} caption V${row.version} is ready for approval.`, deepLink: `/content/${id}` });
  return NextResponse.json(row, { status: 201 });
}

export const POST = api(handlePOST);
