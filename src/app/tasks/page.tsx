import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Badge, Empty, humanize, initials } from "@/components/ui";
import { TaskManager } from "@/components/task-manager";
import { TaskStatus } from "@/components/task-status";
import { redirect } from "next/navigation";

const taskAr: Record<string, string> = { TODO: "جديدة", IN_PROGRESS: "قيد التنفيذ", REVIEW: "مراجعة", REVISION: "تعديل", WAITING_CLIENT: "بانتظار العميل", COMPLETED: "مكتملة" };
const priorityAr: Record<string, string> = { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", URGENT: "عاجلة" };

export default async function Tasks() {
  const user = await requirePageUser();
  if (!hasPermission(user, "tasks.read")) redirect("/");
  const ar = user.language === "AR";
  const ids = assignedClientIds(user);
  const scope = user.role.key === "EDITOR"
    ? { assignees: { some: { userId: user.id } } }
    : ids
      ? { clientId: { in: ids } }
      : {};
  const where = { ...scope, status: { not: "COMPLETED" as const }, category: { not: "SHOOTING_RESERVATION" } };
  const canWrite = hasPermission(user, "tasks.write");
  const canUpdate = hasPermission(user, "tasks.update");

  const [rows, clients, team] = await Promise.all([
    db.task.findMany({ where, include: { client: true, assignees: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    canWrite ? db.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }) : Promise.resolve([]),
    canWrite ? db.user.findMany({ where: { status: "ACTIVE", role: { key: { in: ["ADMIN","MANAGER","EDITOR","SOCIAL_MEDIA_MANAGER"] } } }, include: { role: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return <AppShell user={user} title="Tasks" kicker="WORKLOAD">
    <div className="management-stack">
      {canWrite && <TaskManager clients={clients} users={team.map((u) => ({ id: u.id, name: u.name, role: u.role.name }))} ar={ar} />}
      <div className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">{ar ? "المهام النشطة" : "Active tasks"}</span><h2>{ar ? "المهام الحالية" : "Current workload"}</h2></div><span className="hint">{ar ? "المهمة المكتملة تُؤرشف تلقائياً" : "Completed tasks archive automatically"}</span></div>
        {rows.length ? <table><thead><tr><th>{ar ? "المهمة" : "Task"}</th><th>{ar ? "العميل" : "Client"}</th><th>{ar ? "المكلّفون" : "Assignees"}</th><th>{ar ? "الموعد" : "Due"}</th><th>{ar ? "الأولوية" : "Priority"}</th><th>{ar ? "الحالة" : "Status"}</th>{canUpdate && <th>{ar ? "تحديث" : "Update"}</th>}</tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td className="title-cell"><b>{x.title}</b><small>{x.category}</small></td><td>{x.client?.brandName || "—"}</td><td>{x.assignees.length ? <span className="avatar-stack" title={x.assignees.map((a) => a.user.name).join(", ")}>{x.assignees.map((a) => <span className="avatar avatar-sm" key={a.id} aria-label={a.user.name}>{initials(a.user.name)}</span>)}</span> : "—"}</td><td className="nowrap">{x.dueAt ? <span className={x.dueAt < new Date() ? "overdue" : undefined}>{x.dueAt.toLocaleDateString(ar ? "ar" : undefined, { month: "short", day: "numeric" })}<small>{x.dueAt.toLocaleTimeString(ar ? "ar" : undefined, { hour: "numeric", minute: "2-digit" })}</small></span> : "—"}</td><td><Badge value={x.priority} label={ar ? (priorityAr[x.priority] || x.priority) : humanize(x.priority)} /></td><td><Badge value={x.status} label={ar ? (taskAr[x.status] || x.status) : humanize(x.status)} /></td>{canUpdate && <td><TaskStatus taskId={x.id} current={x.status} ar={ar} /></td>}</tr>)}</tbody></table> : <Empty title={ar ? "ما في مهام نشطة" : "No active tasks"} hint={canWrite ? (ar ? "أنشئ أول مهمة من الأعلى." : "Create the first task above.") : undefined} />}
      </div>
    </div>
  </AppShell>;
}
