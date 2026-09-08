import Link from "next/link";
import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { MonthlyContentPlanner } from "@/components/monthly-content-planner";
import { redirect } from "next/navigation";

function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function validMonth(value?: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : currentMonthKey();
}

function monthBounds(month: string) {
  const [year, value] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, value - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, value, 1, 0, 0, 0));
  return { start, end };
}

function moveMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function Calendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, "calendar.read")) redirect("/");
  const ar = user.language === "AR";
  const params = await searchParams;
  const month = validMonth(params.month);
  const { start, end } = monthBounds(month);
  const ids = assignedClientIds(user);
  const canPlan = hasPermission(user, "calendar.write") && hasPermission(user, "content.write") && user.role.key !== "CLIENT";
  const canSeeShooting = ["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"].includes(user.role.key);

  const [rows, clients, shootingRows] = await Promise.all([
    db.calendarEntry.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        ...(ids ? { content: { clientId: { in: ids } } } : {}),
      },
      include: { content: { include: { client: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    }),
    canPlan
      ? db.client.findMany({
          where: ids ? { id: { in: ids } } : {},
          select: { id: true, brandName: true },
          orderBy: { brandName: "asc" },
        })
      : Promise.resolve([]),
    canSeeShooting
      ? db.task.findMany({
          where: {
            category: "SHOOTING_RESERVATION",
            startAt: { gte: start, lt: end },
          },
          include: { client: true, assignees: { include: { user: true } } },
          orderBy: { startAt: "asc" },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  const reels = rows.filter((row) => row.content.type === "REEL").length;
  const posts = rows.filter((row) => row.content.type === "STATIC_POST").length;
  const monthTitle = start.toLocaleDateString(ar ? "ar-LB" : "en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const previousMonth = moveMonth(month, -1);
  const nextMonth = moveMonth(month, 1);

  return <AppShell user={user} title="Content calendar" kicker="SCHEDULE">
    <div className="management-stack">
      <section className="panel calendar-month-head">
        <div className="section-head">
          <div>
            <span className="eyebrow">{ar ? "تقويم المحتوى" : "CONTENT CALENDAR"}</span>
            <h2>{monthTitle}</h2>
          </div>
          <div className="review-actions">
            <Link className="button secondary" href={`/calendar?month=${previousMonth}`}>← {ar ? "السابق" : "Previous"}</Link>
            <Link className="button secondary" href={`/calendar?month=${nextMonth}`}>{ar ? "التالي" : "Next"} →</Link>
          </div>
        </div>
        <div className="metrics">
          <article><span>{ar ? "بوستات" : "Posts"}</span><b>{posts}</b></article>
          <article><span>{ar ? "ريلز" : "Reels"}</span><b>{reels}</b></article>
          <article><span>{ar ? "أيام تصوير" : "Shoots"}</span><b>{shootingRows.length}</b></article>
          <article><span>{ar ? "المحتوى" : "Content total"}</span><b>{rows.length}</b></article>
        </div>
      </section>

      {canPlan && <MonthlyContentPlanner clients={clients} month={month} ar={ar} />}

      {canSeeShooting && <section className="panel tablewrap">
        <div className="section-head">
          <div><span className="eyebrow">{ar ? "أيام التصوير" : "SHOOTING DAYS"}</span><h2>{ar ? "حجوزات التصوير لهيدا الشهر" : "Shooting reservations this month"}</h2></div>
          <Link className="button secondary" href="/shooting">{ar ? "حجز تصوير" : "Reserve shooting"}</Link>
        </div>
        <table>
          <thead><tr><th>{ar ? "الوقت" : "Time"}</th><th>{ar ? "العميل" : "Client"}</th><th>{ar ? "التصوير" : "Shooting"}</th><th>{ar ? "المكان" : "Location"}</th><th>{ar ? "حجزها" : "Reserved by"}</th></tr></thead>
          <tbody>{shootingRows.map((shoot) => {
            const meta = (shoot.recurrence && typeof shoot.recurrence === "object" ? shoot.recurrence : {}) as { location?: string };
            return <tr key={shoot.id}>
              <td><b>{shoot.startAt?.toLocaleString(ar ? "ar-LB" : "en-US") || "—"}</b><small>{shoot.dueAt?.toLocaleString(ar ? "ar-LB" : "en-US") || "—"}</small></td>
              <td>{shoot.client?.brandName || "—"}</td>
              <td>{shoot.title}</td>
              <td>{meta.location || "—"}</td>
              <td>{shoot.assignees.map((item) => item.user.name).join(", ") || "—"}</td>
            </tr>;
          })}</tbody>
        </table>
        {!shootingRows.length && <p>{ar ? "ما في تصوير محجوز بهيدا الشهر." : "No shooting days reserved this month."}</p>}
      </section>}

      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">{ar ? "مواعيد الشهر" : "MONTH SCHEDULE"}</span><h2>{ar ? "المحتوى حسب التاريخ" : "Content by date"}</h2></div><span className="muted">{month}</span></div>
        <table>
          <thead><tr><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "العميل" : "Client"}</th><th>{ar ? "المحتوى" : "Content"}</th><th>{ar ? "النوع" : "Type"}</th><th>{ar ? "الموافقة" : "Approval"}</th><th>{ar ? "الحالة" : "Status"}</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.id}>
            <td>{x.scheduledAt.toLocaleDateString(ar ? "ar-LB" : "en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</td>
            <td>{x.content.client.brandName}</td>
            <td><Link href={`/content/${x.content.id}`}><b>{x.content.title}</b></Link><small>{x.content.platform.join(" · ")}</small></td>
            <td>{x.content.type === "STATIC_POST" ? (ar ? "بوست" : "Post") : x.content.type === "REEL" ? (ar ? "ريل" : "Reel") : x.content.type.replaceAll("_", " ")}</td>
            <td>{x.content.visualStatus} / {x.content.captionStatus}</td>
            <td>{x.content.status.replaceAll("_", " ")}</td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <p>{ar ? "ما في محتوى مخطط لهيدا الشهر بعد." : "No content planned for this month yet."}</p>}
      </section>
    </div>
  </AppShell>;
}
