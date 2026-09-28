import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ChatThread } from "@/components/chat-thread";
import { Empty } from "@/components/ui";
import { ensureChatTables } from "@/lib/db-upgrades";
import { isChatUser, unreadByClient } from "@/lib/chat";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requirePageUser();
  if (!isChatUser(user)) redirect("/");
  await ensureChatTables();
  const ar = user.language === "AR";
  const { client: requested } = await searchParams;

  if (user.role.key === "CLIENT") {
    const ids = user.clientUsers.map((c) => c.clientId);
    const clients = await db.client.findMany({ where: { id: { in: ids } }, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } });
    const active = clients.find((c) => c.id === requested) || clients[0];
    return <AppShell user={user} title={ar ? "الرسائل" : "Messages"} kicker={ar ? "تواصل" : "Support"}>
      {active
        ? <>
            {clients.length > 1 && <nav className="chat-tabs">{clients.map((c) => <a key={c.id} href={`/chat?client=${c.id}`} className={c.id === active.id ? "active" : ""}>{c.brandName}</a>)}</nav>}
            <ChatThread clientId={active.id} title={ar ? "فريق 24i" : "24i team"} meId={user.id} meName={user.name} meRole={user.role.key} isClient ar={ar} />
          </>
        : <Empty title={ar ? "لا يوجد حساب شركة مرتبط" : "Your account is not linked to a company yet"} />}
    </AppShell>;
  }

  const [clients, last] = await Promise.all([
    db.client.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }),
    db.chatMessage.groupBy({ by: ["clientId"], _max: { createdAt: true } }),
  ]);
  const unread = await unreadByClient(user);
  const lastAt = new Map(last.map((l) => [l.clientId, l._max.createdAt]));
  const threads = clients
    .map((c) => ({ ...c, lastAt: lastAt.get(c.id) || null, unread: unread.get(c.id) || 0 }))
    .sort((a, b) => (b.lastAt?.getTime() || 0) - (a.lastAt?.getTime() || 0) || a.brandName.localeCompare(b.brandName));
  const active = threads.find((t) => t.id === requested) || (requested ? undefined : threads.find((t) => t.lastAt));

  return <AppShell user={user} title={ar ? "الرسائل" : "Messages"} kicker={ar ? "تواصل" : "Clients"}>
    {threads.length === 0
      ? <Empty title={ar ? "لا يوجد عملاء بعد" : "No clients yet"} />
      : <div className={`chat-layout${active ? " has-active" : ""}`}>
          <aside className="panel chat-list">
            {threads.map((t) => <a key={t.id} href={`/chat?client=${t.id}`} className={`chat-list-item${t.id === active?.id ? " active" : t.unread ? " unread" : ""}`}>
              <span className="chat-list-name"><b>{t.brandName}</b><small>{t.lastAt ? t.lastAt.toLocaleString(ar ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" }) : (ar ? "لا رسائل بعد" : "No messages yet")}</small></span>
              {t.unread > 0 && t.id !== active?.id && <span className="chat-count">{t.unread}</span>}
            </a>)}
          </aside>
          {active
            ? <ChatThread key={active.id} clientId={active.id} title={active.brandName} meId={user.id} meName={user.name} meRole={user.role.key} ar={ar} backHref="/chat" />
            : <div className="panel chat-placeholder"><Empty title={ar ? "اختر محادثة" : "Choose a conversation"} /></div>}
        </div>}
  </AppShell>;
}
