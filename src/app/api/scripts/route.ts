import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { scriptTeamRecipients } from "@/lib/script-team";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

const internalRoles = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"]);

async function handlePOST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const isClient = (await authorize("content.read", parsed.data.clientId)).role.key === "CLIENT";
  if (isClient) return createClientScript(parsed.data);

  const user = await authorize("content.write", parsed.data.clientId);
  if (!internalRoles.has(user.role.key)) {
    return NextResponse.json({ error: "Only Admin, Manager or Social Media Manager can send scripts" }, { status: 403 });
  }

  const client = await db.client.findUnique({
    where: { id: parsed.data.clientId },
    include: { users: { include: { user: { include: { role: true } } } } },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const script = await db.$transaction(async (tx) => {
    const row = await tx.contentItem.create({
      data: {
        clientId: parsed.data.clientId,
        title: parsed.data.title,
        type: "OTHER",
        platform: ["SCRIPT"],
        status: "WAITING_CLIENT_APPROVAL",
        visualStatus: "NOT_REQUIRED",
        captionStatus: "WAITING",
        ownerId: user.id,
        captions: {
          create: {
            version: 1,
            caption: parsed.data.body,
            createdById: user.id,
          },
        },
      },
      include: { captions: true },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SCRIPT_SENT_TO_CLIENT",
        entityType: "ContentItem",
        entityId: row.id,
        newValue: { clientId: parsed.data.clientId, title: parsed.data.title },
      },
    });

    return row;
  });

  const clientUserIds = client.users
    .filter((link) => link.user.status === "ACTIVE" && link.user.role.key === "CLIENT")
    .map((link) => link.userId);

  if (clientUserIds.length) {
    await notify(clientUserIds, {
      kind: "APPROVAL",
      title: "Script ready for approval",
      body: `${user.name} sent “${script.title}” for ${client.brandName}. Review it and approve or request changes.`,
      deepLink: `/scripts#${script.id}`,
    });
  }

  return NextResponse.json(script, { status: 201 });
}

// Scripts written by the client need no approval: they go straight to the team to use.
async function createClientScript(data: z.infer<typeof schema>) {
  const user = await authorize("content.read", data.clientId);
  const client = await db.client.findUnique({ where: { id: data.clientId }, select: { id: true, brandName: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const script = await db.$transaction(async (tx) => {
    const row = await tx.contentItem.create({
      data: {
        clientId: data.clientId,
        title: data.title,
        type: "OTHER",
        platform: ["SCRIPT"],
        status: "APPROVED",
        visualStatus: "NOT_REQUIRED",
        captionStatus: "APPROVED",
        ownerId: user.id,
        captions: { create: { version: 1, caption: data.body, createdById: user.id } },
      },
    });
    await tx.auditLog.create({
      data: { userId: user.id, action: "SCRIPT_SUBMITTED_BY_CLIENT", entityType: "ContentItem", entityId: row.id, newValue: { clientId: data.clientId, title: data.title } },
    });
    return row;
  });

  const recipients = await scriptTeamRecipients(data.clientId, user.id);
  if (recipients.length) {
    await notify(recipients, {
      kind: "TASK",
      title: "New script from client",
      body: `${client.brandName} wrote “${script.title}”.`,
      deepLink: `/scripts#${script.id}`,
    });
  }
  return NextResponse.json(script, { status: 201 });
}

export const POST = api(handlePOST);
