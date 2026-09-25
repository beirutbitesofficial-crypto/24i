import Link from "next/link";
import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Badge, Empty, humanize } from "@/components/ui";
import { ContentManager } from "@/components/content-manager";
import { redirect } from "next/navigation";

export default async function Content() {
  const user = await requirePageUser();
  if (!hasPermission(user, "content.read")) redirect("/");
  const ids = assignedClientIds(user);
  const canWrite = hasPermission(user, "content.write");
  const [rows, clients, owners] = await Promise.all([
    db.contentItem.findMany({ where: ids ? { clientId: { in: ids } } : {}, include: { client: true, versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    canWrite ? db.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }) : Promise.resolve([]),
    canWrite ? db.user.findMany({ where: { status: "ACTIVE", role: { key: { in: ["ADMIN","MANAGER","EDITOR","SOCIAL_MEDIA_MANAGER"] } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return <AppShell user={user} title="Content" kicker="PRODUCTION">
    <div className="management-stack">
      {canWrite && <ContentManager clients={clients} owners={owners} />}
      <div className="panel tablewrap">{rows.length ? <table><thead><tr><th>Content</th><th>Client</th><th>Type</th><th>Version</th><th>Visual</th><th>Caption</th><th>Workflow</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><Link href={`/content/${x.id}`}><b>{x.title}</b></Link><small>{x.platform.join(" · ")}</small></td><td>{x.client.brandName}</td><td>{humanize(x.type)}</td><td>{x.versions[0] ? `V${x.versions[0].version}` : "—"}</td><td><Badge value={x.visualStatus} /></td><td><Badge value={x.captionStatus} /></td><td><Badge value={x.status} /></td></tr>)}</tbody></table> : <Empty title="No content yet" hint={canWrite ? "Add the first content item above." : undefined} />}</div>
    </div>
  </AppShell>;
}
