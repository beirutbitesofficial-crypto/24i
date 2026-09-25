import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Badge, Empty, initials } from "@/components/ui";
import { TaskManager } from "@/components/task-manager";
import { TaskStatus } from "@/components/task-status";
import { redirect } from "next/navigation";

export default async function Tasks() {
  const user = await requirePageUser();
  if (!hasPermission(user, "tasks.read")) redirect("/");
  const ids = assignedClientIds(user);
  const where = user.role.key === "EDITOR"
    ? { assignees: { some: { userId: user.id } } }
    : ids ? { clientId: { in: ids } } : {};
  const canWrite = hasPermission(user, "tasks.write");
  const canUpdate = hasPermission(user, "tasks.update");

  const [rows, clients, team] = await Promise.all([
    db.task.findMany({ where, include: { client: true, assignees: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    canWrite ? db.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }) : Promise.resolve([]),
    canWrite ? db.user.findMany({ where: { status: "ACTIVE", role: { key: { in: ["ADMIN","MANAGER","EDITOR","SOCIAL_MEDIA_MANAGER"] } } }, include: { role: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return <AppShell user={user} title="Tasks" kicker="WORKLOAD">
    <div className="management-stack">
      {canWrite && <TaskManager clients={clients} users={team.map((u) => ({ id: u.id, name: u.name, role: u.role.name }))} />}
      <div className="panel tablewrap">{rows.length ? <table><thead><tr><th>Task</th><th>Client</th><th>Assignees</th><th>Due</th><th>Priority</th><th>Status</th>{canUpdate && <th>Update</th>}</tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td className="title-cell"><b>{x.title}</b><small>{x.category}</small></td><td>{x.client?.brandName || "—"}</td><td>{x.assignees.length ? <span className="avatar-stack" title={x.assignees.map((a) => a.user.name).join(", ")}>{x.assignees.map((a) => <span className="avatar avatar-sm" key={a.id} aria-label={a.user.name}>{initials(a.user.name)}</span>)}</span> : "—"}</td><td className="nowrap">{x.dueAt ? <span className={x.dueAt < new Date() && x.status !== "COMPLETED" ? "overdue" : undefined}>{x.dueAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}<small>{x.dueAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></span> : "—"}</td><td><Badge value={x.priority} /></td><td><Badge value={x.status} /></td>{canUpdate && <td><TaskStatus taskId={x.id} current={x.status} /></td>}</tr>)}</tbody></table> : <Empty title="No tasks yet" hint={canWrite ? "Create the first task above." : "Tasks assigned to you will appear here."} />}</div>
    </div>
  </AppShell>;
}
