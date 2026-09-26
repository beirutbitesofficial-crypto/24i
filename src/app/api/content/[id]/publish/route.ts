import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { authorizeRecord } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishApprovedContent } from "@/lib/publishing";

// Retries automatic publishing for approved content (only channels that did not already succeed).
async function handlePOST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const content = await db.contentItem.findUnique({ where: { id }, select: { clientId: true, visualStatus: true, captionStatus: true } });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await authorizeRecord("content.schedule", content.clientId);
  if (!["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"].includes(user.role.key)) {
    return NextResponse.json({ error: "Only the agency team can retry publishing" }, { status: 403 });
  }
  if (content.visualStatus !== "APPROVED" || !["APPROVED", "NOT_REQUIRED"].includes(content.captionStatus)) {
    return NextResponse.json({ error: "The client has not approved this content yet" }, { status: 409 });
  }
  try {
    const result = await publishApprovedContent(id);
    await db.auditLog.create({ data: { userId: user.id, action: "AUTO_PUBLISH_RETRIED", entityType: "ContentItem", entityId: id, newValue: result } });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Publishing failed" }, { status: 400 });
  }
}

export const POST = api(handlePOST);
