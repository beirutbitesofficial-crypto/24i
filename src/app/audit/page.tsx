import { redirect } from "next/navigation";
import { requirePageUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Empty, humanize } from "@/components/ui";

export default async function AuditPage() {
  const user = await requirePageUser();
  if (!hasPermission(user, "audit.read")) redirect("/");
  const rows = await db.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return <AppShell user={user} title="Audit log" kicker="Accountability"><div className="panel tablewrap">{rows.length ? <table><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.createdAt.toLocaleString()}</td><td>{r.user?.name||"System"}</td><td><b>{humanize(r.action)}</b></td><td>{r.entityType}</td><td><small>{r.entityId}</small></td></tr>)}</tbody></table> : <Empty title="No audit events yet" />}</div></AppShell>;
}
