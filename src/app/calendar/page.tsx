import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Badge, Empty, humanize } from "@/components/ui";
import { redirect } from "next/navigation";

export default async function Calendar() {
  const user = await requirePageUser();
  if (!hasPermission(user, "calendar.read")) redirect("/");
  const ids = assignedClientIds(user);
  const rows = await db.calendarEntry.findMany({
    where: ids ? { content: { clientId: { in: ids } } } : {},
    include: { content: { include: { client: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });

  return <AppShell user={user} title="Content calendar" kicker="SCHEDULE">
    <div className="panel tablewrap">{rows.length ? <table><thead><tr><th>Date & time</th><th>Client</th><th>Content</th><th>Platform</th><th>Approval</th><th>Publishing</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><b>{x.scheduledAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</b><small>{x.scheduledAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></td><td>{x.content.client.brandName}</td><td><a className="table-link" href={`/content/${x.content.id}`}><b>{x.content.title}</b></a><small>{humanize(x.content.type)}</small></td><td>{x.content.platform.join(" · ")}</td><td><Badge value={x.content.visualStatus} label={`Visual: ${humanize(x.content.visualStatus)}`} /> <Badge value={x.content.captionStatus} label={`Caption: ${humanize(x.content.captionStatus)}`} /></td><td><Badge value={x.publishingStatus} /></td></tr>)}</tbody></table> : <Empty title="Nothing scheduled" hint="Approved content appears here once it’s scheduled." />}</div>
  </AppShell>;
}
