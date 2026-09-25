import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Badge, Empty } from "@/components/ui";
import { ClientManager } from "@/components/client-manager";
import { redirect } from "next/navigation";
import { SocialPublishingSettings } from "@/components/social-publishing-settings";
import { bufferConfigured } from "@/lib/buffer";

export default async function Clients() {
  const user = await requirePageUser();
  if (!hasPermission(user, "clients.read")) redirect("/");
  const ids = assignedClientIds(user);
  const rows = await db.client.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: { _count: { select: { projects: true, tasks: true, content: true } } },
    orderBy: { brandName: "asc" },
  });

  const canManagePublishing = ["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"].includes(user.role.key);
  const socialChannels = canManagePublishing ? await db.socialChannel.findMany({ where: { provider: "BUFFER", ...(ids ? { clientId: { in: ids } } : {}) }, select: { id: true, clientId: true, channelId: true, service: true, name: true, autoPublish: true }, orderBy: { service: "asc" } }) : [];

  return <AppShell user={user} title={user.role.key === "CLIENT" ? "My company" : "Clients"} kicker="RELATIONSHIPS">
    <div className="management-stack">
      {hasPermission(user, "clients.write") && <ClientManager />}
      {canManagePublishing && <SocialPublishingSettings clients={rows.map((client) => ({ id: client.id, brandName: client.brandName }))} initialMappings={socialChannels} configured={bufferConfigured()} ar={user.language === "AR"} />}
      <div className="panel tablewrap">{rows.length ? <table><thead><tr><th>Brand</th><th>Contact</th><th>Status</th><th>Projects</th><th>Tasks</th><th>Content</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><b>{x.brandName}</b><small>{x.industry || "—"}</small></td><td>{x.contactName}<small>{x.email}</small></td><td><Badge value={x.status} /></td><td>{x._count.projects}</td><td>{x._count.tasks}</td><td>{x._count.content}</td></tr>)}</tbody></table> : <Empty title={user.language === "AR" ? "لا يوجد عملاء بعد" : "No clients yet"} />}</div>
    </div>
  </AppShell>;
}
