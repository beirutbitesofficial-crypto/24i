import { NextResponse, after } from "next/server";
import { z } from "zod";
import { api } from "@/lib/http";
import { AuthError, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { ensureChatTables } from "@/lib/db-upgrades";
import { CHAT_ROLES, canUseThread, chatRecipients } from "@/lib/chat";

type Ctx = { params: Promise<{ clientId: string }> };

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
  toRole: z.enum(CHAT_ROLES).optional(),
});

const ROLE_LABEL: Record<string, string> = { MANAGER: "Manager", SOCIAL_MEDIA_MANAGER: "Social media", EDITOR: "Editor" };

async function thread(clientId: string, since?: Date) {
  const messages = await db.chatMessage.findMany({
    where: { clientId, ...(since ? { createdAt: { gt: since } } : {}) },
    include: { author: { select: { id: true, name: true, role: { select: { key: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return messages.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    toRole: m.toRole,
    createdAt: m.createdAt.toISOString(),
    author: { id: m.author.id, name: m.author.name, role: m.author.role.key, roleName: m.author.role.name },
  }));
}

async function markRead(userId: string, clientId: string) {
  const now = new Date();
  await db.chatRead.upsert({ where: { userId_clientId: { userId, clientId } }, create: { userId, clientId, lastReadAt: now }, update: { lastReadAt: now } });
}

async function handleGET(req: Request, { params }: Ctx) {
  const user = await requireUser();
  const { clientId } = await params;
  if (!canUseThread(user, clientId)) throw new AuthError(403);
  await ensureChatTables();
  // ?after=<ISO time> returns only newer messages, so polling stays cheap.
  const afterParam = new URL(req.url).searchParams.get("after");
  const since = afterParam && !Number.isNaN(Date.parse(afterParam)) ? new Date(afterParam) : undefined;
  if (since) {
    const messages = await thread(clientId, since);
    if (messages.length) await markRead(user.id, clientId);
    return NextResponse.json({ messages, partial: true }, { headers: { "cache-control": "no-store" } });
  }
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, brandName: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const [messages] = await Promise.all([thread(clientId), markRead(user.id, clientId)]);
  return NextResponse.json({ client, messages }, { headers: { "cache-control": "no-store" } });
}

async function handlePOST(req: Request, { params }: Ctx) {
  const user = await requireUser();
  const { clientId } = await params;
  if (!canUseThread(user, clientId)) throw new AuthError(403);
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Write a message first" }, { status: 400 });
  const fromClient = user.role.key === "CLIENT";
  if (fromClient && !parsed.data.toRole) return NextResponse.json({ error: "Choose who the message is for" }, { status: 400 });

  await ensureChatTables();
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, brandName: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const message = await db.chatMessage.create({
    data: { clientId, authorId: user.id, body: parsed.data.body, toRole: fromClient ? parsed.data.toRole : null },
  });

  // Recipients and notifications are handled after the response, so the sender sees the
  // message straight away.
  const toRole = parsed.data.toRole;
  const body = parsed.data.body;
  after(async () => {
    try {
      await markRead(user.id, clientId);
      const preview = body.length > 140 ? `${body.slice(0, 137)}…` : body;
      let recipients = fromClient
        ? await chatRecipients(clientId, toRole!)
        : (await db.clientUser.findMany({ where: { clientId, user: { status: "ACTIVE", role: { key: "CLIENT" } } }, select: { userId: true } })).map((c) => c.userId);
      recipients = recipients.filter((id) => id !== user.id);
      if (recipients.length) {
        await notify(recipients, {
          kind: "SYSTEM",
          title: fromClient ? `💬 ${client.brandName} → ${ROLE_LABEL[toRole!]}` : `💬 ${user.name} (${user.role.name})`,
          body: preview,
          deepLink: fromClient ? `/chat?client=${clientId}` : "/chat",
        });
      }
    } catch (error) {
      console.error("chat notification failed", error);
    }
  });

  return NextResponse.json({
    ok: true,
    message: { id: message.id, body: message.body, toRole: message.toRole, createdAt: message.createdAt.toISOString(), author: { id: user.id, name: user.name, role: user.role.key, roleName: user.role.name } },
  });
}

export const GET = api(handleGET);
export const POST = api(handlePOST);
