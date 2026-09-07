import { currentUser, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default async function Home() {
  const user = await currentUser();
  if (!user) return <main className="login"><section><div className="logo">24i</div><h1>Agency work, in one place.</h1><p>Sign in to manage production, approvals, calendars and finance.</p><LoginForm /></section></main>;

  const ar = user.language === "AR";
  const firstName = user.name.split(" ")[0];
  const greeting = ar ? `أهلاً، ${firstName}` : `Good morning, ${firstName}`;
  const clientIds = assignedClientIds(user);
  const scope = clientIds ? { clientId: { in: clientIds } } : {};
  const approvalsPromise = db.contentItem.count({ where: { ...scope, status: "WAITING_CLIENT_APPROVAL" } });
  const revisionsPromise = db.contentItem.count({ where: { ...scope, status: "REVISION_REQUESTED" } });
  const notificationsPromise = db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 });

  if (user.role.key === "CLIENT") {
    const [approvals, revisions, scheduled, notifications] = await Promise.all([
      approvalsPromise,
      revisionsPromise,
      db.contentItem.count({ where: { ...scope, status: "SCHEDULED" } }),
      notificationsPromise,
    ]);
    return <AppShell user={user} title={greeting} kicker="TODAY">
      <div className="metrics">
        <article><span>{ar ? "بانتظار موافقتك" : "Waiting approval"}</span><b>{approvals}</b></article>
        <article><span>{ar ? "طلبات التعديل" : "Revisions"}</span><b>{revisions}</b></article>
        <article><span>{ar ? "محتوى مجدول" : "Scheduled content"}</span><b>{scheduled}</b></article>
      </div>
      <div className="section-head"><div><span className="eyebrow">{ar ? "المطلوب منك" : "YOUR ACTIONS"}</span><h2>{ar ? "مركز المتابعة" : "Action center"}</h2></div></div>
      <div className="panel">{notifications.length ? notifications.map((n) => <Link key={n.id} href={n.deepLink}><b>{n.title}</b><span>{n.body}</span></Link>) : <p>{ar ? "ما في شي مطلوب منك حالياً ✅" : "You’re all caught up. ✅"}</p>}</div>
    </AppShell>;
  }

  const taskWhere = user.role.key === "EDITOR"
    ? { assignees: { some: { userId: user.id } }, status: { not: "COMPLETED" as const } }
    : { ...scope, status: { not: "COMPLETED" as const } };
  const [tasks, approvals, revisions, notifications] = await Promise.all([
    db.task.count({ where: taskWhere }), approvalsPromise, revisionsPromise, notificationsPromise,
  ]);

  return <AppShell user={user} title={greeting} kicker="TODAY">
    <div className="metrics">
      <article><span>{ar ? "مهام مفتوحة" : "Open tasks"}</span><b>{tasks}</b></article>
      <article><span>{ar ? "بانتظار الموافقة" : "Waiting approval"}</span><b>{approvals}</b></article>
      <article><span>{ar ? "طلبات تعديل" : "Revisions"}</span><b>{revisions}</b></article>
    </div>
    <div className="section-head"><div><span className="eyebrow">{ar ? "الأولوية" : "PRIORITY"}</span><h2>{ar ? "مركز المتابعة" : "Action center"}</h2></div></div>
    <div className="panel">{notifications.length ? notifications.map((n) => <Link key={n.id} href={n.deepLink}><b>{n.title}</b><span>{n.body}</span></Link>) : <p>{ar ? "كل شي مرتب، ما في تنبيهات جديدة ✅" : "You’re all caught up. ✅"}</p>}</div>
  </AppShell>;
}
