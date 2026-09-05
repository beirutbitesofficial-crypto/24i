import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ClientManager } from "@/components/client-manager";
import { redirect } from "next/navigation";

export default async function Clients() {
  const user = await requireUser();
  if (!hasPermission(user, "clients.read")) redirect("/");
  const ids = assignedClientIds(user);
  const rows = await db.client.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: { _count: { select: { projects: true, tasks: true, content: true } } },
    orderBy: { brandName: "asc" },
  });

  return <AppShell user={user} title={user.role.key === "CLIENT" ? "My company" : "Clients"} kicker="RELATIONSHIPS">
    <div className="management-stack">
      {hasPermission(user, "clients.write") && <ClientManager />}
      <div className="panel tablewrap"><table><thead><tr><th>Brand</th><th>Contact</th><th>Status</th><th>Projects</th><th>Tasks</th><th>Content</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><b>{x.brandName}</b><small>{x.industry || "—"}</small></td><td>{x.contactName}<small>{x.email}</small></td><td>{x.status}</td><td>{x._count.projects}</td><td>{x._count.tasks}</td><td>{x._count.content}</td></tr>)}</tbody></table>{!rows.length && <p>No clients assigned yet.</p>}</div>
    </div>
  </AppShell>;
}
