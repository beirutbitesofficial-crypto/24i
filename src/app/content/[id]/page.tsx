import { notFound, redirect } from "next/navigation";
import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ContentWorkflow } from "@/components/content-workflow";
import { Badge, Card, Empty, humanize } from "@/components/ui";

export default async function ContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  if (!hasPermission(user, "content.read")) redirect("/");
  const { id } = await params;
  const content = await db.contentItem.findUnique({
    where: { id },
    include: {
      client: true,
      versions: { include: { uploadedBy: true, slides: { orderBy: { position: "asc" } } }, orderBy: { version: "desc" } },
      captions: { orderBy: { version: "desc" } },
      approvals: { include: { notes: true }, orderBy: { createdAt: "desc" } },
      calendar: true,
    },
  });
  if (!content) notFound();
  const ids = assignedClientIds(user);
  if (ids && !ids.includes(content.clientId)) redirect("/content");

  const latestCaption = content.captions[0];
  const canUpload = hasPermission(user, "content.upload") && (user.role.key !== "EDITOR" || content.ownerId === user.id);
  const files = canUpload
    ? await db.fileObject.findMany({ where: { clientId: content.clientId, deletedAt: null }, select: { id: true, originalName: true, mimeType: true }, orderBy: { createdAt: "desc" }, take: 200 })
    : [];
  const fileIds = [...new Set(content.versions.flatMap((v) => [v.fileId, ...v.slides.map((s) => s.fileId)]).filter((x): x is string => Boolean(x)))];
  const fileNames = new Map((await db.fileObject.findMany({ where: { id: { in: fileIds } }, select: { id: true, originalName: true } })).map((f) => [f.id, f.originalName]));
  const done = (s: string) => s === "APPROVED" || s === "NOT_REQUIRED";

  return <AppShell user={user} title={content.title} kicker={`${content.client.brandName} · ${humanize(content.type)}`}>
    <div className="management-stack">
      <div className="metrics">
        <article><span>Visual</span><b className="metric-text"><Badge value={content.visualStatus} /></b></article>
        <article><span>Caption</span><b className="metric-text"><Badge value={content.captionStatus} /></b></article>
        <article><span>Workflow</span><b className="metric-text"><Badge value={content.status} /></b></article>
      </div>

      <div className="grid-2">
        <Card eyebrow="Details" title="Overview">
          <dl className="kv">
            <dt>Client</dt><dd>{content.client.brandName}</dd>
            <dt>Format</dt><dd>{humanize(content.type)}</dd>
            <dt>Platforms</dt><dd>{content.platform.join(", ")}</dd>
            <dt>Scheduled</dt><dd>{content.calendar?.scheduledAt.toLocaleString() || content.plannedAt?.toLocaleString() || "Not scheduled"}</dd>
          </dl>
        </Card>
        <Card eyebrow="Latest caption" title={latestCaption ? `Version ${latestCaption.version}` : "No caption yet"}>
          {latestCaption
            ? <><p className="caption-preview">{latestCaption.caption}</p>{latestCaption.hashtags && <p className="muted">{latestCaption.hashtags}</p>}{latestCaption.cta && <p><b>CTA:</b> {latestCaption.cta}</p>}</>
            : <p className="muted">The caption will appear here once it’s submitted.</p>}
        </Card>
      </div>

      <ContentWorkflow
        contentId={content.id}
        canWrite={hasPermission(user, "content.write")}
        canUpload={canUpload}
        canApprove={hasPermission(user, "content.approve")}
        canSchedule={hasPermission(user, "content.schedule")}
        isCarousel={content.type === "CAROUSEL"}
        hasVersion={content.versions.length > 0}
        hasCaption={content.captions.length > 0}
        readyToSchedule={content.visualStatus === "APPROVED" && done(content.captionStatus)}
        files={files.map((f) => ({ id: f.id, name: f.originalName, mimeType: f.mimeType }))}
      />

      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">Versions</span><h2>Production history</h2></div></div>
        {content.versions.length
          ? <table><thead><tr><th>Version</th><th>Uploaded by</th><th>Date</th><th>Asset</th><th>Notes</th></tr></thead><tbody>{content.versions.map((v) => <tr key={v.id}>
              <td><b>V{v.version}</b></td>
              <td>{v.uploadedBy.name}</td>
              <td className="nowrap">{v.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
              <td>{v.slides.length
                ? <>{v.slides.length} slides<small>{v.slides.map((s) => fileNames.get(s.fileId) ?? "file").join(", ")}</small></>
                : v.fileId ? <a href={`/api/files/${v.fileId}/download`}>{fileNames.get(v.fileId) ?? "Download"}</a> : "—"}</td>
              <td>{v.notes || "—"}</td>
            </tr>)}</tbody></table>
          : <Empty title="No versions yet" hint="Submitted visuals and videos appear here." />}
      </section>

      <Card eyebrow="Feedback" title="Approval history">
        {content.approvals.length
          ? content.approvals.map((a) => <article className="approval-line" key={a.id}>
              <div><b>{humanize(a.scope)}</b><Badge value={a.state} /></div>
              <small>{(a.decidedAt || a.createdAt).toLocaleString()}</small>
              {a.notes.map((n) => <p key={n.id}>{n.body}</p>)}
            </article>)
          : <Empty title="No approval activity yet" />}
      </Card>
    </div>
  </AppShell>;
}
