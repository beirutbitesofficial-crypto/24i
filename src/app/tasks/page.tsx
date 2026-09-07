import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { TaskManager } from "@/components/task-manager";
import { TaskStatus } from "@/components/task-status";
import { redirect } from "next/navigation";

const taskAr: Record<string, string> = { TODO: "جديدة", IN_PROGRESS: "قيد التنفيذ", REVIEW: "مراجعة", REVISION: "تعديل", WAITING_CLIENT: "بانتظار العميل", COMPLETED: "مكتملة" };
const priorityAr: Record<string, string> = { LOW: "منخفضة", MEDIUM: "متوسطة", HIGH: "عالية", URGENT: "عاجلة" };

export default async function Tasks() {
  const user = await requireUser();
  if (!hasPermission(user, "tasks.read")) redirect("/");
  const ar = user.language === "AR";
  const ids = assignedClientIds(user);
  const where = user.role.key === "EDITOR" ? { assignees: { some: { userId: user.id } } } : ids ? { clientId: { in: ids } } : {};
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
      <div className="panel tablewrap"><table><thead><tr><th>{ar ? "المهمة" : "Task"}</th><th>{ar ? "العميل" : "Client"}</th><th>{ar ? "المكلّفون" : "Assignees"}</th><th>{ar ? "الموعد" : "Due"}</th><th>{ar ? "الأولوية" : "Priority"}</th><th>{ar ? "الحالة" : "Status"}</th>{canUpdate && <th>{ar ? "تحديث" : "Update"}</th>}</tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><b>{x.title}</b><small>{x.category}</small></td><td>{x.client?.brandName || "—"}</td><td>{x.assignees.map((a) => a.user.name).join(", ") || "—"}</td><td>{x.dueAt?.toLocaleString() || "—"}</td><td>{ar ? (priorityAr[x.priority] || x.priority) : x.priority}</td><td>{ar ? (taskAr[x.status] || x.status) : x.status.replaceAll("_", " ")}</td>{canUpdate && <td><TaskStatus taskId={x.id} current={x.status} ar={ar} /></td>}</tr>)}</tbody></table>{!rows.length && <p>{ar ? "ما في مهام بعد." : "No tasks yet."}</p>}</div>
    </div>
  </AppShell>;
}
