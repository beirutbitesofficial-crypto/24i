import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("DECIDE"),
    decision: z.enum(["APPROVED", "REVISION_REQUESTED"]),
    note: z.string().trim().max(3000).optional(),
  }).refine((value) => value.decision === "APPROVED" || !!value.note, { message: "Revision note is required" }),
  z.object({
    action: z.literal("RESEND"),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
  }),
]);

const internalRoles = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const script = await db.contentItem.findFirst({
    where: { id, platform: { has: "SCRIPT" } },
    include: {
      client: { include: { users: { include: { user: { include: { role: true } } } } } },
      captions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!script) return NextResponse.json({ error: "Script not found" }, { status: 404 });

  if (parsed.data.action === "RESEND") {
    const user = await authorize("content.write", script.clientId);
    if (!internalRoles.has(user.role.key)) {
      return NextResponse.json({ error: "Only Admin, Manager or Social Media Manager can resend scripts" }, { status: 403 });
    }

    const latestVersion = script.captions[0]?.version || 0;
    await db.$transaction(async (tx) => {
      await tx.captionVersion.create({
        data: {
          contentId: script.id,
          version: latestVersion + 1,
          caption: parsed.data.body,
          createdById: user.id,
        },
      });
      await tx.contentItem.update({
        where: { id: script.id },
        data: {
          title: parsed.data.title,
          status: "WAITING_CLIENT_APPROVAL",
          visualStatus: "NOT_REQUIRED",
          captionStatus: "WAITING",
          ownerId: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "SCRIPT_REVISED_AND_RESENT",
          entityType: "ContentItem",
          entityId: script.id,
          newValue: { title: parsed.data.title, version: latestVersion + 1 },
        },
      });
    });

    const clientUserIds = script.client.users
      .filter((link) => link.user.status === "ACTIVE" && link.user.role.key === "CLIENT")
      .map((link) => link.userId);
    if (clientUserIds.length) {
      await notify(clientUserIds, {
        kind: "APPROVAL",
        title: "Revised script ready",
        body: `${user.name} updated “${parsed.data.title}”. Review the new version.`,
        deepLink: `/scripts#${script.id}`,
      });
    }

    return NextResponse.json({ ok: true });
  }

  const user = await authorize("content.approve", script.clientId);
  if (user.role.key !== "CLIENT") {
    return NextResponse.json({ error: "Only the client can approve or reject a script" }, { status: 403 });
  }
  if (script.status !== "WAITING_CLIENT_APPROVAL" || !script.captions[0]) {
    return NextResponse.json({ error: "This script is not waiting for client approval" }, { status: 409 });
  }

  const decision = parsed.data.decision;
  await db.$transaction(async (tx) => {
    await tx.approval.create({
      data: {
        contentId: script.id,
        captionVersionId: script.captions[0].id,
        reviewerId: user.id,
        scope: "CAPTION",
        state: decision,
        decidedAt: new Date(),
        notes: parsed.data.note
          ? { create: { authorId: user.id, body: parsed.data.note } }
          : undefined,
      },
    });
    await tx.contentItem.update({
      where: { id: script.id },
      data: {
        captionStatus: decision,
        visualStatus: "NOT_REQUIRED",
        status: decision === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED",
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: decision === "APPROVED" ? "SCRIPT_APPROVED" : "SCRIPT_REVISION_REQUESTED",
        entityType: "ContentItem",
        entityId: script.id,
        newValue: { decision, note: parsed.data.note },
      },
    });
  });

  let socialManagers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      role: { key: "SOCIAL_MEDIA_MANAGER" },
      clientUsers: { some: { clientId: script.clientId } },
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
    script.ownerId,
    script.captions[0].createdById,
    ...socialManagers.map((manager) => manager.id),
    ...managers.map((manager) => manager.id),
  ].filter((recipientId): recipientId is string => !!recipientId && recipientId !== user.id))];

  if (recipients.length) {
    await notify(recipients, {
      kind: decision === "APPROVED" ? "APPROVAL" : "REVISION",
      title: decision === "APPROVED" ? "Script approved by client" : "Client requested script changes",
      body: decision === "APPROVED"
        ? `${script.client.brandName} approved “${script.title}”.`
        : `${script.client.brandName} requested changes on “${script.title}”: ${parsed.data.note}`,
      deepLink: `/scripts#${script.id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
