import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMeetingTables } from "@/lib/db-upgrades";
import { MEETING_ROLES, clientWhatsAppLink, formatMeetingDate } from "@/lib/meetings";
import { whatsappConfigured } from "@/lib/whatsapp";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui";
import { MeetingActions } from "@/components/meeting-actions";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const user = await requirePageUser();
  if (!MEETING_ROLES.includes(user.role.key)) redirect("/");
  const ar = user.language === "AR";
  await ensureMeetingTables();

  const today = new Date().toISOString().slice(0, 10);
  const [pending, upcoming, recent] = await Promise.all([
    db.meetingRequest.findMany({ where: { status: "PENDING" }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    db.meetingRequest.findMany({ where: { status: "CONFIRMED", date: { gte: today } }, orderBy: [{ date: "asc" }, { time: "asc" }] }),
    db.meetingRequest.findMany({ where: { OR: [{ status: "DECLINED" }, { status: "CONFIRMED", date: { lt: today } }] }, orderBy: { updatedAt: "desc" }, take: 30 }),
  ]);

  const table = (rows: typeof pending, empty: string) => rows.length ? <table>
    <thead><tr>
      <th>{ar ? "الموعد" : "When"}</th><th>{ar ? "العميل" : "Client"}</th><th>{ar ? "الموضوع" : "Topic"}</th><th>{ar ? "الحالة" : "Status"}</th><th />
    </tr></thead>
    <tbody>{rows.map((m) => <tr key={m.id}>
      <td><b>{formatMeetingDate(m.date)}</b><small>{m.time} · {m.format}</small></td>
      <td><b>{m.name}</b><small>{m.phone} · {m.email}</small></td>
      <td>{m.service}{m.notes && <small>{m.notes}</small>}</td>
      <td><Badge value={m.status} />{m.decidedByName && <small>{m.decidedByName}{m.clientNotifiedAt ? (ar ? " · أُبلغ على واتساب" : " · WhatsApp sent") : ""}</small>}</td>
      <td><MeetingActions id={m.id} status={m.status} ar={ar} waConfirmed={clientWhatsAppLink(m, "CONFIRMED")} waDeclined={clientWhatsAppLink(m, "DECLINED")} /></td>
    </tr>)}</tbody>
  </table> : <p className="muted">{empty}</p>;

  return <AppShell user={user} title="Meetings" kicker="WEBSITE BOOKINGS">
    <div className="management-stack">
      {!whatsappConfigured() && <section className="panel">
        <p className="muted">{ar
          ? "واتساب التلقائي غير مفعّل بعد: بعد التأكيد اضغط «واتساب العميل» لإرسال الرسالة الجاهزة."
          : "Automatic WhatsApp isn't set up yet: after confirming, tap “WhatsApp client” to send the ready-made message."}</p>
      </section>}
      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">{ar ? "بانتظار التأكيد" : "WAITING FOR YOU"}</span><h2>{ar ? "طلبات جديدة" : "Pending requests"}</h2></div><span className="muted">{pending.length}</span></div>
        {table(pending, ar ? "ما في طلبات جديدة." : "No pending requests.")}
      </section>
      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">{ar ? "القادمة" : "UPCOMING"}</span><h2>{ar ? "اجتماعات مؤكدة" : "Confirmed meetings"}</h2></div><span className="muted">{upcoming.length}</span></div>
        {table(upcoming, ar ? "ما في اجتماعات قادمة." : "No upcoming meetings.")}
      </section>
      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">{ar ? "السجل" : "HISTORY"}</span><h2>{ar ? "سابقة ومرفوضة" : "Past and declined"}</h2></div></div>
        {table(recent, ar ? "لا شيء بعد." : "Nothing yet.")}
      </section>
    </div>
  </AppShell>;
}
