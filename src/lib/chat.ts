import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { canAccessClient, type SessionUser } from "./auth";
import { ensureChatTables } from "./db-upgrades";

export const CHAT_ROLES = ["MANAGER", "SOCIAL_MEDIA_MANAGER", "EDITOR"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

const STAFF = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER", "EDITOR"]);

export const isChatUser = (user: SessionUser) => user.role.key === "CLIENT" || STAFF.has(user.role.key);

export function canUseThread(user: SessionUser, clientId: string) {
  return user.role.key === "CLIENT" ? canAccessClient(user, clientId) : STAFF.has(user.role.key);
}

// Which messages count as unread for this user: editors only see what was sent to editors
// as "for them", SMMs what was sent to social media; managers and admins see everything.
export function unreadFilter(user: SessionUser): Prisma.ChatMessageWhereInput {
  if (user.role.key === "CLIENT") return { author: { role: { key: { not: "CLIENT" } } } };
  if (user.role.key === "EDITOR" || user.role.key === "SOCIAL_MEDIA_MANAGER") {
    return { toRole: user.role.key, author: { role: { key: "CLIENT" } } };
  }
  return { author: { role: { key: "CLIENT" } } };
}

export async function unreadByClient(user: SessionUser, clientIds?: string[]) {
  await ensureChatTables();
  const reads = await db.chatRead.findMany({ where: { userId: user.id, ...(clientIds ? { clientId: { in: clientIds } } : {}) } });
  const lastRead = new Map(reads.map((r) => [r.clientId, r.lastReadAt]));
  const messages = await db.chatMessage.findMany({
    where: { ...unreadFilter(user), authorId: { not: user.id }, ...(clientIds ? { clientId: { in: clientIds } } : {}) },
    select: { clientId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  const counts = new Map<string, number>();
  for (const m of messages) {
    const read = lastRead.get(m.clientId);
    if (!read || m.createdAt > read) counts.set(m.clientId, (counts.get(m.clientId) || 0) + 1);
  }
  return counts;
}

export function chatClientIds(user: SessionUser) {
  return user.role.key === "CLIENT" ? user.clientUsers.map((c) => c.clientId) : undefined;
}

// Staff who should hear about a client's message. Prefer people assigned to that client
// (or, for editors, owning its content); fall back to everyone with the role, then to admins.
export async function chatRecipients(clientId: string, toRole: ChatRole) {
  const active = { status: "ACTIVE" as const, role: { key: toRole } };
  let ids: string[] = [];
  if (toRole !== "MANAGER") {
    const owners = toRole === "EDITOR"
      ? (await db.contentItem.findMany({ where: { clientId, ownerId: { not: null } }, select: { ownerId: true }, distinct: ["ownerId"] })).map((c) => c.ownerId!)
      : [];
    ids = (await db.user.findMany({ where: { ...active, OR: [{ clientUsers: { some: { clientId } } }, { id: { in: owners } }] }, select: { id: true } })).map((u) => u.id);
  }
  if (!ids.length) ids = (await db.user.findMany({ where: active, select: { id: true } })).map((u) => u.id);
  if (!ids.length) ids = (await db.user.findMany({ where: { status: "ACTIVE", role: { key: "ADMIN" } }, select: { id: true } })).map((u) => u.id);
  return ids;
}
