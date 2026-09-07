import Link from "next/link";
import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ContentManager } from "@/components/content-manager";
import { redirect } from "next/navigation";

const statusAr: Record<string, string> = {
  NOT_REQUIRED: "غير مطلوب",
  DRAFT: "مسودة",
  WAITING: "بانتظار الموافقة",
  APPROVED: "موافق عليه",
  REVISION_REQUESTED: "مطلوب تعديل",
  IDEA: "فكرة",
  CONTENT_PLAN: "خطة محتوى",
  PRODUCTION: "إنتاج",
  UPLOAD: "رفع",
  WAITING_CLIENT_APPROVAL: "بانتظار موافقة العميل",
  CLIENT_REVIEW: "مراجعة العميل",
  CAPTION_APPROVED: "الكابشن موافق عليه",
  READY_TO_SCHEDULE: "جاهز للجدولة",
  SCHEDULED: "مجدول",
  PUBLISHED: "منشور",
};

export default async function Content() {
  const user = await requireUser();
  if (!hasPermission(user, "content.read")) redirect("/");
  const ar = user.language === "AR";
  const ids = assignedClientIds(user);
  const canWrite = hasPermission(user, "content.write");
  const [rows, clients, owners] = await Promise.all([
    db.contentItem.findMany({ where: ids ? { clientId: { in: ids } } : {}, include: { client: true, versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    canWrite ? db.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }) : Promise.resolve([]),
    canWrite ? db.user.findMany({ where: { status: "ACTIVE", role: { key: { in: ["ADMIN","MANAGER","EDITOR","SOCIAL_MEDIA_MANAGER"] } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  const s = (value: string) => ar ? (statusAr[value] || value.replaceAll("_", " ")) : value.replaceAll("_", " ");

  return <AppShell user={user} title="Content" kicker="PRODUCTION">
    <div className="management-stack">
      {canWrite && <ContentManager clients={clients} owners={owners} ar={ar} />}
      <div className="panel tablewrap"><table><thead><tr>
        <th>{ar ? "المحتوى" : "Content"}</th><th>{ar ? "العميل" : "Client"}</th><th>{ar ? "النوع" : "Type"}</th><th>{ar ? "النسخة" : "Version"}</th><th>{ar ? "التصميم/الفيديو" : "Visual"}</th><th>{ar ? "الكابشن" : "Caption"}</th><th>{ar ? "النشر" : "Publishing"}</th>
      </tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><Link href={`/content/${x.id}`}><b>{x.title}</b></Link><small>{x.platform.join(" · ")}</small></td><td>{x.client.brandName}</td><td>{x.type.replaceAll("_", " ")}</td><td>V{x.versions[0]?.version || 0}</td><td>{s(x.visualStatus)}</td><td>{s(x.captionStatus)}</td><td>{s(x.status)}</td></tr>)}</tbody></table>{!rows.length && <p>{ar ? "ما في محتوى بعد." : "No content yet."}</p>}</div>
    </div>
  </AppShell>;
}
