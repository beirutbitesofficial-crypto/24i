import { redirect } from "next/navigation";
import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ScriptWorkflow } from "@/components/script-workflow";

const allowedRoles = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER", "EDITOR", "CLIENT"]);

export default async function ScriptsPage() {
  const user = await requirePageUser();
  if (!hasPermission(user, "content.read") || !allowedRoles.has(user.role.key)) redirect("/");

  const ar = user.language === "AR";
  const isClient = user.role.key === "CLIENT";
  const ids = assignedClientIds(user);
  const canWrite = !isClient && hasPermission(user, "content.write") && ["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"].includes(user.role.key);

  const [rows, clients] = await Promise.all([
    db.contentItem.findMany({
      where: {
        platform: { has: "SCRIPT" },
        ...(ids ? { clientId: { in: ids } } : {}),
      },
      include: {
        client: true,
        captions: { orderBy: { version: "desc" }, take: 1 },
        approvals: { include: { notes: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    canWrite || isClient
      ? db.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } })
      : Promise.resolve([]),
  ]);

  const ownerIds = [...new Set(rows.map((r) => r.ownerId).filter((id): id is string => !!id))];
  const owners = new Map((await db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, name: true, role: { select: { key: true } } } })).map((u) => [u.id, u]));

  const scripts = rows.map((row) => ({
    id: row.id,
    title: row.title,
    clientId: row.clientId,
    clientName: row.client.brandName,
    status: row.status,
    captionStatus: row.captionStatus,
    body: row.captions[0]?.caption || "",
    version: row.captions[0]?.version || 0,
    decisionNote: row.status === "REVISION_REQUESTED" ? (row.approvals[0]?.notes[0]?.body || null) : null,
    updatedAt: row.updatedAt.toISOString(),
    byClient: owners.get(row.ownerId || "")?.role.key === "CLIENT",
    authorName: owners.get(row.ownerId || "")?.name || null,
    mine: row.ownerId === user.id,
  }));

  return <AppShell user={user} title="Scripts" kicker="APPROVALS">
    <ScriptWorkflow clients={clients} scripts={scripts} isClient={isClient} canWrite={canWrite} ar={ar} />
  </AppShell>;
}
