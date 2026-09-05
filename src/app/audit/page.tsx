import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export default async function AuditPage() {
  const user = await requireUser();
  if (!hasPermission(user, "audit.read")) redirect("/");
  const rows = await db.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return <AppShell user={user} title="Audit log" kicker="ACCOUNTABILITY"><div className="panel tablewrap"><table><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.createdAt.toLocaleString()}</td><td>{r.user?.name||"System"}</td><td><b>{r.action.replaceAll("_"," ")}</b></td><td>{r.entityType}</td><td><small>{r.entityId}</small></td></tr>)}</tbody></table>{!rows.length&&<p>No audit events yet.</p>}</div></AppShell>;
}
