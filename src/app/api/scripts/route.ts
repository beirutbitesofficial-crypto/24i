import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

const internalRoles = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"]);

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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
