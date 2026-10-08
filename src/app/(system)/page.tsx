import Link from "next/link";
import { currentUser, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { LoginForm } from "@/components/login-form";
import { AppShell } from "@/components/app-shell";
import { AuthLayout } from "@/components/auth-layout";
import { Empty, Icon } from "@/components/ui";

// Returns a short title for the top bar plus a role-specific tagline for the page body.
function homeGreeting(role: string, firstName: string, ar: boolean) {
  // Use the agency's local time (Beirut), not the server's timezone.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut", hour: "numeric", hourCycle: "h23", weekday: "short", day: "numeric", month: "numeric" }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(part("hour"));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
  const weekend = day === 5 || day === 6 || day === 0;

  if (weekend) {
    return { title: ar ? `عطلة سعيدة، ${firstName}` : `Have a nice weekend, ${firstName}`, tagline: "" };
  }

  const period = hour < 12
    ? (ar ? "صباح الخير" : "Good morning")
    : hour < 18
      ? (ar ? "نهارك سعيد" : "Good afternoon")
      : (ar ? "مسا الخير" : "Good evening");

  const lines: Record<string, { en: string[]; ar: string[] }> = {
    EDITOR: {
      en: ["Let’s make the next cut hit 🎬", "Fresh timeline, fresh ideas ✂️", "Make every frame count 🎥"],
      ar: ["يلا نخلي كل كادر يحكي 🎬", "مونتاج جديد، أفكار جديدة ✂️", "خلّي النسخة الجاية تضرب 🎥"],
    },
    SOCIAL_MEDIA_MANAGER: {
      en: ["Let’s make today scroll-stopping 📱", "Fresh ideas, strong content 🚀", "Time to make the feed move ✨"],
      ar: ["يلا نعمل محتوى بوقّف السكرول 📱", "أفكار جديدة ومحتوى أقوى 🚀", "اليوم بدنا نحرّك الـfeed ✨"],
    },
    MANAGER: {
      en: ["Keep the team moving 🚀", "Clear priorities, smooth day 🎯", "Let’s keep everything on track ✨"],
      ar: ["خلّي الفريق ماشي عالسكة 🚀", "أولويات واضحة ونهار مرتب 🎯", "يلا نخلي كل شي ماشي تمام ✨"],
    },
    ADMIN: {
      en: ["Big picture, smooth execution 🚀", "Keep the whole operation moving 🎯", "Another day to build better ✨"],
      ar: ["الصورة الكبيرة والتنفيذ المرتب 🚀", "خلّي كل العملية ماشية 🎯", "نهار جديد لنطوّر أكتر ✨"],
    },
    CLIENT: {
      en: ["Your content is in good hands 😎", "Let’s make your brand shine ✨", "Good things are cooking for your brand 👀"],
      ar: ["محتواك بإيد أمينة 😎", "يلا نخلي البراند يلمع ✨", "في شغلات حلوة عم تنطبخ للبراند 👀"],
    },
  };

  const pool = lines[role] || lines.ADMIN;
  const choices = ar ? pool.ar : pool.en;
  const index = (Number(part("day")) + Number(part("month")) + Math.floor(hour / 3)) % choices.length;
  return { title: ar ? `${period}، ${firstName}` : `${period}, ${firstName}`, tagline: choices[index] };
}

export default async function Home() {
  const user = await currentUser();
  if (!user) return <AuthLayout title="Sign in" subtitle="Use the email and password your agency gave you."><LoginForm /></AuthLayout>;

  const ar = user.language === "AR";
  const greeting = homeGreeting(user.role.key, user.name.split(" ")[0], ar);
  const clientIds = assignedClientIds(user);
  const scope = clientIds ? { clientId: { in: clientIds } } : {};
  const isClient = user.role.key === "CLIENT";
  const taskWhere = user.role.key === "EDITOR"
    ? { assignees: { some: { userId: user.id } }, status: { not: "COMPLETED" as const } }
    : { ...scope, status: { not: "COMPLETED" as const } };

  const [first, approvals, revisions, notifications, upcoming] = await Promise.all([
    isClient ? db.contentItem.count({ where: { ...scope, status: "SCHEDULED" } }) : db.task.count({ where: taskWhere }),
    db.contentItem.count({ where: { ...scope, status: "WAITING_CLIENT_APPROVAL" } }),
    db.contentItem.count({ where: { ...scope, status: "REVISION_REQUESTED" } }),
    db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.calendarEntry.findMany({ where: { scheduledAt: { gte: new Date() }, ...(clientIds ? { content: { clientId: { in: clientIds } } } : {}) }, include: { content: { include: { client: true } } }, orderBy: { scheduledAt: "asc" }, take: 5 }),
  ]);

  const metrics = [
    isClient
      ? { label: ar ? "محتوى مجدول" : "Scheduled content", value: first, icon: "calendar", href: "/calendar" }
      : { label: ar ? "مهام مفتوحة" : "Open tasks", value: first, icon: "check", href: "/tasks" },
    { label: isClient ? (ar ? "بانتظار موافقتك" : "Waiting your approval") : (ar ? "بانتظار الموافقة" : "Waiting approval"), value: approvals, icon: "clock", href: "/content" },
    { label: ar ? "طلبات تعديل" : "Revisions requested", value: revisions, icon: "alert", href: "/content" },
  ];
  const today = new Intl.DateTimeFormat(ar ? "ar" : "en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Beirut" }).format(new Date());

  return <AppShell user={user} title={greeting.title} kicker={today}>
    {greeting.tagline && <p className="lead">{greeting.tagline}</p>}
    <div className="metrics">
      {metrics.map((m) => <Link key={m.label} href={m.href} className="metric"><span><Icon name={m.icon} size={16} />{m.label}</span><b>{m.value}</b></Link>)}
    </div>
    <div className="grid-2">
      <section className="panel">
        <div className="section-head"><div><span className="eyebrow">{isClient ? (ar ? "المطلوب منك" : "Your actions") : (ar ? "الأولوية" : "Action center")}</span><h2>{ar ? "إشعارات غير مقروءة" : "Unread notifications"}</h2></div><Link href="/notifications">{ar ? "عرض الكل" : "View all"}</Link></div>
        {notifications.length
          ? <div className="list">{notifications.map((n) => <Link key={n.id} href={n.deepLink}><span className="row-main"><b>{n.title}</b><span>{n.body}</span></span><Icon name="arrow" size={16} /></Link>)}</div>
          : <Empty title={ar ? "كل شي مرتب ✅" : "You’re all caught up"} hint={ar ? "الموافقات والمهام الجديدة رح تظهر هون." : "New approvals, tasks and reminders will show up here."} />}
      </section>
      <section className="panel">
        <div className="section-head"><div><span className="eyebrow">{ar ? "النشر" : "Publishing"}</span><h2>{ar ? "القادم" : "Coming up next"}</h2></div><Link href="/calendar">{ar ? "التقويم" : "Calendar"}</Link></div>
        {upcoming.length
          ? <div className="list">{upcoming.map((x) => <Link key={x.id} href={`/content/${x.contentId}`}><span className="row-main"><b>{x.content.title}</b><span>{x.content.client.brandName} · {x.content.platform.join(", ")}</span></span><small className="muted">{x.scheduledAt.toLocaleString(ar ? "ar" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Beirut" })}</small></Link>)}</div>
          : <Empty title={ar ? "لا شيء مجدول" : "Nothing scheduled"} hint={ar ? "المحتوى الموافق عليه يظهر هون بعد جدولته." : "Approved content appears here once it’s scheduled."} />}
      </section>
    </div>
  </AppShell>;
}
