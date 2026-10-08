import { redirect } from "next/navigation";
import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ProjectManager } from "@/components/project-manager";

export default async function ProjectsPage() {
  const user = await requireUser();
  if (!hasPermission(user, "projects.read")) redirect("/");
  const ids = assignedClientIds(user);
  const canWrite = hasPermission(user, "projects.write");
  const [projects, clients] = await Promise.all([
    db.project.findMany({ where: ids ? { clientId: { in: ids } } : {}, include: { client: true, _count: { select: { tasks: true, content: true } } }, orderBy: { createdAt: "desc" } }),
    canWrite ? db.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }) : Promise.resolve([]),
  ]);

  return <AppShell user={user} title="Projects" kicker="PRODUCTION PIPELINE"><div className="management-stack">{canWrite && <ProjectManager clients={clients} />}<div className="panel tablewrap"><table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Tasks</th><th>Content</th></tr></thead><tbody>{projects.map((p) => <tr key={p.id}><td><b>{p.name}</b><small>{p.description || "—"}</small></td><td>{p.client.brandName}</td><td>{p.status}</td><td>{p._count.tasks}</td><td>{p._count.content}</td></tr>)}</tbody></table>{!projects.length && <p>No projects yet.</p>}</div></div></AppShell>;
}
