import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";

export default async function Calendar() {
  const user = await requireUser();
  if (!hasPermission(user, "calendar.read")) redirect("/");
  const ids = assignedClientIds(user);
  const rows = await db.calendarEntry.findMany({
    where: ids ? { content: { clientId: { in: ids } } } : {},
    include: { content: { include: { client: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });

  return <AppShell user={user} title="Content calendar" kicker="SCHEDULE">
    <div className="panel tablewrap"><table><thead><tr><th>Date & time</th><th>Client</th><th>Content</th><th>Platform</th><th>Approval</th><th>Publishing</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td>{x.scheduledAt.toLocaleString()}</td><td>{x.content.client.brandName}</td><td><b>{x.content.title}</b><small>{x.content.type.replaceAll("_", " ")}</small></td><td>{x.content.platform.join(" · ")}</td><td>{x.content.visualStatus} / {x.content.captionStatus}</td><td>{x.publishingStatus}</td></tr>)}</tbody></table>{!rows.length && <p>No scheduled content.</p>}</div>
  </AppShell>;
}
