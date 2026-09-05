import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ApprovalActions } from "@/components/approval-actions";
import { ContentUpload } from "@/components/content-upload";

export default async function ContentReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const content = await db.contentItem.findUnique({
    where: { id },
    include: {
      client: true,
      versions: { orderBy: { version: "desc" }, take: 1 },
      approvals: { orderBy: { createdAt: "desc" }, take: 10, include: { notes: true } }
    }
  });
  if (!content) notFound();
  if (u.role.key === "CLIENT" && !u.clientUsers.some(x => x.clientId === content.clientId)) notFound();

  const version = content.versions[0];
  const file = version?.fileId ? await db.fileObject.findFirst({ where: { id: version.fileId, deletedAt: null } }) : null;
  const latestDecision = content.approvals.find(a => a.state !== "WAITING");
  const latestNote = content.approvals.flatMap(a => a.notes).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const isClient = u.role.key === "CLIENT";
  const canUpload = ["ADMIN", "MANAGER", "EDITOR"].includes(u.role.key);

  return <AppShell user={u} title={content.title} kicker={`${content.client.brandName} · REVIEW`}>
    <div className="review-grid">
      <section className="panel review-media">
        <div className="review-meta">
          <div><span>Version</span><b>V{version?.version || 0}</b></div>
          <div><span>Visual status</span><b>{content.visualStatus.replaceAll("_", " ")}</b></div>
          <div><span>Publishing</span><b>{content.status.replaceAll("_", " ")}</b></div>
        </div>
        {file ? <div className="media-frame">
          {file.mimeType.startsWith("video/") ? <video controls playsInline preload="metadata" src={`/api/files/${file.id}/download`} /> : file.mimeType.startsWith("image/") ? <img src={`/api/files/${file.id}/download`} alt={content.title} /> : <a href={`/api/files/${file.id}/download`}>Open uploaded file</a>}
        </div> : <div className="empty-media"><b>No file uploaded yet.</b><span>The editor can upload the first version from this page.</span></div>}
        {version?.notes && <div className="version-note"><span>Editor note</span><p>{version.notes}</p></div>}
      </section>

      <aside className="review-sidebar">
        <section className="panel decision-card">
          <span className="eyebrow">CLIENT DECISION</span>
          <h2>{content.visualStatus === "APPROVED" ? "Approved" : content.visualStatus === "REVISION_REQUESTED" ? "Revision requested" : "Waiting for review"}</h2>
          {latestDecision && <p className="decision-time">Last decision: {latestDecision.state.replaceAll("_", " ")}</p>}
          {latestNote && <div className="client-note"><b>Client note</b><p>{latestNote.body}</p></div>}
          {isClient && version && content.visualStatus === "WAITING" && <ApprovalActions contentId={content.id} />}
          {isClient && !version && <p>The editor has not uploaded a version yet.</p>}
          {isClient && content.visualStatus === "APPROVED" && <p className="success-copy">This version is approved. The editor and social media manager have been notified.</p>}
        </section>

        {canUpload && <section className="panel"><ContentUpload contentId={content.id} clientId={content.clientId} currentVersion={version?.version || 0} /></section>}
      </aside>
    </div>
  </AppShell>;
}
