import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ShootingReservationForm } from "@/components/shooting-reservation-form";

const allowedRoles = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"]);

export default async function ShootingPage() {
  const user = await requireUser();
  if (!allowedRoles.has(user.role.key) || !hasPermission(user, "calendar.read")) redirect("/");

  const ar = user.language === "AR";
  const canWrite = hasPermission(user, "calendar.write");
  const now = new Date();

  const [reservations, clients] = await Promise.all([
    db.task.findMany({
      where: {
        category: "SHOOTING_RESERVATION",
        dueAt: { gte: now },
      },
      include: { client: true, assignees: { include: { user: true } } },
      orderBy: { startAt: "asc" },
      take: 100,
    }),
    canWrite
      ? db.client.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: "asc" } })
      : Promise.resolve([]),
  ]);

  return <AppShell user={user} title="Shooting days" kicker="PRODUCTION">
    <div className="management-stack">
      {canWrite && <ShootingReservationForm clients={clients} ar={ar} />}

      <section className="panel tablewrap">
        <div className="section-head">
          <div><span className="eyebrow">{ar ? "الحجوزات القادمة" : "UPCOMING SHOOTS"}</span><h2>{ar ? "أيام التصوير المحجوزة" : "Reserved shooting days"}</h2></div>
          <span className="muted">{reservations.length}</span>
        </div>
        <table>
          <thead><tr><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "العميل" : "Client"}</th><th>{ar ? "التصوير" : "Shooting"}</th><th>{ar ? "المكان" : "Location"}</th><th>{ar ? "حجزها" : "Reserved by"}</th><th>{ar ? "ملاحظات" : "Notes"}</th></tr></thead>
          <tbody>{reservations.map((reservation) => {
            const meta = (reservation.recurrence && typeof reservation.recurrence === "object" ? reservation.recurrence : {}) as { location?: string };
            return <tr key={reservation.id}>
              <td><b>{reservation.startAt?.toLocaleString(ar ? "ar-LB" : "en-US") || "—"}</b><small>{reservation.dueAt?.toLocaleString(ar ? "ar-LB" : "en-US") || "—"}</small></td>
              <td>{reservation.client?.brandName || "—"}</td>
              <td><b>{reservation.title}</b></td>
              <td>{meta.location || "—"}</td>
              <td>{reservation.assignees.map((item) => item.user.name).join(", ") || "—"}</td>
              <td>{reservation.description || "—"}</td>
            </tr>;
          })}</tbody>
        </table>
        {!reservations.length && <p>{ar ? "ما في أيام تصوير محجوزة." : "No shooting days reserved yet."}</p>}
      </section>
    </div>
  </AppShell>;
}
