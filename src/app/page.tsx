import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { AppShell } from "@/components/app-shell";

export default async function Home() {
  const user = await currentUser();
  if (!user) return <main className="login"><section><div className="logo">24i</div><h1>Agency work, in one place.</h1><p>Sign in to manage production, approvals, calendars and finance.</p><LoginForm /></section></main>;

  const clientIds = user.role.key === "CLIENT" ? user.clientUsers.map(x => x.clientId) : undefined;
  const scope = clientIds ? { clientId: { in: clientIds } } : {};
  const [tasks, approvals, revisions, notifications] = await Promise.all([
    db.task.count({ where: user.role.key === "CLIENT" ? { clientId: { in: clientIds } } : { assignees: { some: { userId: user.id } }, status: { not: "COMPLETED" } } }),
    db.contentItem.count({ where: { ...scope, status: "WAITING_CLIENT_APPROVAL" } }),
    db.contentItem.count({ where: { ...scope, status: "REVISION_REQUESTED" } }),
    db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  return <AppShell user={user} title={`Good morning, ${user.name.split(" ")[0]}`} kicker="TODAY">
    <div className="metrics">
      <article><span>Open tasks</span><b>{tasks}</b></article>
      <article><span>Waiting approval</span><b>{approvals}</b></article>
      <article><span>Revisions</span><b>{revisions}</b></article>
    </div>
    <h2>Action center</h2>
    <div className="panel">
      {notifications.length ? notifications.map(n => <Link key={n.id} href={n.deepLink}><b>{n.title}</b><span>{n.body}</span></Link>) : <p>You’re all caught up.</p>}
    </div>
  </AppShell>;
}
