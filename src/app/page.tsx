import Link from "next/link";
import { currentUser, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
import { AppShell } from "@/components/app-shell";
import { Empty, Icon } from "@/components/ui";

function greeting(name: string, ar: boolean) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Beirut" }).format(new Date()));
  const first = name.split(" ")[0];
  if (ar) return `${hour < 12 ? "صباح الخير" : "مساء الخير"}، ${first}`;
  return `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${first}`;
}

function Login() {
  return <main className="login">
    <section className="login-hero">
      <div className="brand"><span className="brand-mark">24i</span><span className="brand-name">Production<small>Agency OS</small></span></div>
      <div>
        <h1>Agency work, in one place.</h1>
        <p>Plan content, collect client approvals, schedule publishing and keep finances exact — from one workspace.</p>
        <ul className="login-points">
          <li><Icon name="check" />Separate visual and caption approvals</li>
          <li><Icon name="calendar" />Content calendar and publishing schedule</li>
          <li><Icon name="wallet" />Invoices, payments and reports to the cent</li>
        </ul>
      </div>
      <footer>© {new Date().getFullYear()} 24i Production</footer>
    </section>
    <section className="login-panel">
      <div className="login-card">
        <h2>Sign in</h2>
        <p className="muted">Use the email and password your agency gave you.</p>
        <LoginForm />
      </div>
    </section>
  </main>;
}

export default async function Home() {
  const user = await currentUser();
  if (!user) return <Login />;

  const ar = user.language === "AR";
  const clientIds = assignedClientIds(user);
  const scope = clientIds ? { clientId: { in: clientIds } } : {};
  const approvalsPromise = db.contentItem.count({ where: { ...scope, status: "WAITING_CLIENT_APPROVAL" } });
  const revisionsPromise = db.contentItem.count({ where: { ...scope, status: "REVISION_REQUESTED" } });
  const notificationsPromise = db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 6 });
  const upcomingPromise = db.calendarEntry.findMany({ where: { scheduledAt: { gte: new Date() }, ...(clientIds ? { content: { clientId: { in: clientIds } } } : {}) }, include: { content: { include: { client: true } } }, orderBy: { scheduledAt: "asc" }, take: 5 });

  const isClient = user.role.key === "CLIENT";
  const taskWhere = user.role.key === "EDITOR"
    ? { assignees: { some: { userId: user.id } }, status: { not: "COMPLETED" as const } }
    : { ...scope, status: { not: "COMPLETED" as const } };

  const [first, approvals, revisions, notifications, upcoming] = await Promise.all([
    isClient ? db.contentItem.count({ where: { ...scope, status: "SCHEDULED" } }) : db.task.count({ where: taskWhere }),
    approvalsPromise, revisionsPromise, notificationsPromise, upcomingPromise,
  ]);

  const metrics = [
    isClient
      ? { label: "Scheduled content", value: first, icon: "calendar", href: "/calendar" }
      : { label: "Open tasks", value: first, icon: "check", href: "/tasks" },
    { label: "Waiting approval", value: approvals, icon: "clock", href: "/content" },
    { label: "Revisions requested", value: revisions, icon: "alert", href: "/content" },
  ];

  return <AppShell user={user} title={greeting(user.name, ar)} kicker={new Intl.DateTimeFormat(ar ? "ar" : "en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Beirut" }).format(new Date())}>
    <div className="metrics">
      {metrics.map((m) => <Link key={m.label} href={m.href} className="metric"><span><Icon name={m.icon} size={16} />{m.label}</span><b>{m.value}</b></Link>)}
    </div>
    <div className="grid-2">
      <section className="panel">
        <div className="section-head"><div><span className="eyebrow">Action center</span><h2>Unread notifications</h2></div><Link href="/notifications" >View all</Link></div>
        {notifications.length
          ? <div className="list">{notifications.map((n) => <Link key={n.id} href={n.deepLink}><span className="row-main"><b>{n.title}</b><span>{n.body}</span></span><Icon name="arrow" size={16} /></Link>)}</div>
          : <Empty title="You’re all caught up" hint="New approvals, tasks and reminders will show up here." />}
      </section>
      <section className="panel">
        <div className="section-head"><div><span className="eyebrow">Publishing</span><h2>Coming up next</h2></div><Link href="/calendar" >Calendar</Link></div>
        {upcoming.length
          ? <div className="list">{upcoming.map((x) => <Link key={x.id} href={`/content/${x.contentId}`}><span className="row-main"><b>{x.content.title}</b><span>{x.content.client.brandName} · {x.content.platform.join(", ")}</span></span><small className="muted">{x.scheduledAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Beirut" })}</small></Link>)}</div>
          : <Empty title="Nothing scheduled" hint="Approved content appears here once it’s scheduled." />}
      </section>
    </div>
  </AppShell>;
}
