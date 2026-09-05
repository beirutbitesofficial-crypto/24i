import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export default async function Content() {
  const u = await requireUser();
  const ids = u.role.key === "CLIENT" ? u.clientUsers.map(x => x.clientId) : undefined;
  const rows = await db.contentItem.findMany({
    where: ids ? { clientId: { in: ids } } : {},
    include: { client: true, versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 100
  });

  return <AppShell user={u} title="Content" kicker="PRODUCTION">
    <div className="panel tablewrap">
      <table>
        <thead><tr><th>Content</th><th>Client</th><th>Type</th><th>Version</th><th>Visual</th><th>Caption</th><th>Publishing</th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.id}>
          <td><Link className="content-link" href={`/content/${x.id}/approvals`}><b>{x.title}</b><small>{x.platform.join(" · ")}</small></Link></td>
          <td>{x.client.brandName}</td>
          <td>{x.type.replaceAll("_", " ")}</td>
          <td>V{x.versions[0]?.version || 0}</td>
          <td><span className={`status-pill ${x.visualStatus.toLowerCase()}`}>{x.visualStatus.replaceAll("_", " ")}</span></td>
          <td>{x.captionStatus.replaceAll("_", " ")}</td>
          <td>{x.status.replaceAll("_", " ")}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p>No content yet.</p>}
    </div>
  </AppShell>;
}
