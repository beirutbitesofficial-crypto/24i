import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkProject, checkStaff, firstError } from "@/lib/scope";

const schema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  type: z.enum(["STATIC_POST", "CAROUSEL", "REEL", "STORY", "TIKTOK", "YOUTUBE_SHORT", "FACEBOOK_POST", "LINKEDIN_POST", "ADVERTISEMENT", "OTHER"]),
  platform: z.array(z.string().trim().min(1).max(40)).min(1).max(10),
  ownerId: z.string().optional(),
});

async function handlePOST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  const u = await authorize("content.write", p.data.clientId);
  const invalid = await firstError(checkProject(p.data.projectId, p.data.clientId), checkStaff(p.data.ownerId ? [p.data.ownerId] : []));
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const row = await db.$transaction(async (tx) => {
    const c = await tx.contentItem.create({ data: { ...p.data, status: "IDEA" } });
    await tx.auditLog.create({ data: { userId: u.id, action: "CONTENT_CREATED", entityType: "ContentItem", entityId: c.id, newValue: p.data } });
    return c;
  });
  return NextResponse.json(row, { status: 201 });
}

export const POST = api(handlePOST);
