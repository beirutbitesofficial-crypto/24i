import { notFound, redirect } from "next/navigation";
import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ContentWorkflow } from "@/components/content-workflow";

const statusAr: Record<string, string> = {
  NOT_REQUIRED: "غير مطلوب", DRAFT: "مسودة", WAITING: "بانتظار الموافقة", APPROVED: "موافق عليه", REVISION_REQUESTED: "مطلوب تعديل",
  IDEA: "فكرة", CONTENT_PLAN: "خطة محتوى", PRODUCTION: "إنتاج", UPLOAD: "رفع", WAITING_CLIENT_APPROVAL: "بانتظار موافقة العميل",
  CLIENT_REVIEW: "مراجعة العميل", CAPTION_APPROVED: "الكابشن موافق عليه", READY_TO_SCHEDULE: "جاهز للجدولة", SCHEDULED: "مجدول", PUBLISHED: "منشور",
};

export default async function ContentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, "content.read")) redirect("/");
  const ar = user.language === "AR";
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

  const latestVersion = content.versions[0];
  const latestCaption = content.captions[0];
  const latestFile = latestVersion?.fileId ? await db.fileObject.findFirst({ where: { id: latestVersion.fileId, deletedAt: null } }) : null;
  const slideIds = latestVersion?.slides.map((slide) => slide.fileId) || [];
  const slideFiles = slideIds.length ? await db.fileObject.findMany({ where: { id: { in: slideIds }, deletedAt: null } }) : [];
  const slideFileMap = new Map(slideFiles.map((file) => [file.id, file]));

  const latestRevision = content.approvals.find((a) => a.state === "REVISION_REQUESTED" && a.notes.length);
  const canUpload = hasPermission(user, "content.upload") && (user.role.key !== "EDITOR" || content.ownerId === user.id);
  const storageReady = Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET);
  const isClient = user.role.key === "CLIENT";
  const isCarousel = content.type === "CAROUSEL";
  const s = (value: string) => ar ? (statusAr[value] || value.replaceAll("_", " ")) : value.replaceAll("_", " ");

  const workflow = <ContentWorkflow
    contentId={content.id} clientId={content.clientId} currentVersion={latestVersion?.version || 0} currentCaptionVersion={latestCaption?.version || 0}
    canWrite={hasPermission(user, "content.write")} canUpload={canUpload} canApprove={hasPermission(user, "content.approve")} canSchedule={hasPermission(user, "content.schedule")}
    isCarousel={isCarousel} isClient={isClient} storageReady={storageReady} visualStatus={content.visualStatus} contentStatus={content.status}
    captionText={latestCaption?.caption || null} captionHashtags={latestCaption?.hashtags || null} captionCta={latestCaption?.cta || null} ar={ar}
  />;

  return <AppShell user={user} title={content.title} kicker={content.client.brandName.toUpperCase()}>
    <div className="management-stack">
      <div className="metrics">
        <article><span>{ar ? "الفيديو/التصميم" : "Visual"}</span><b className="metric-text">{s(content.visualStatus)}</b></article>
        <article><span>{ar ? "الكابشن" : "Caption"}</span><b className="metric-text">{s(content.captionStatus)}</b></article>
        <article><span>{ar ? "النشر" : "Publishing"}</span><b className="metric-text">{s(content.status)}</b></article>
      </div>

      <section className="panel content-review-player">
        <div className="section-head">
          <div><span className="eyebrow">{ar ? "آخر نسخة" : "LATEST VISUAL"}</span><h2>{latestVersion ? `V${latestVersion.version}` : (ar ? "بانتظار أول رفع" : "Waiting for first upload")}</h2></div>
          {latestVersion && <span className="muted">{ar ? `رفعها ${latestVersion.uploadedBy.name}` : `Uploaded by ${latestVersion.uploadedBy.name}`}</span>}
        </div>

        {isCarousel && latestVersion?.slides.length ? <div className="carousel-review-grid">
          {latestVersion.slides.map((slide) => {
            const file = slideFileMap.get(slide.fileId);
            if (!file) return <div className="review-empty" key={slide.id}>{ar ? `السلايد ${slide.position + 1} غير متوفر` : `Slide ${slide.position + 1} unavailable`}</div>;
            return <div className="carousel-review-slide" key={slide.id}>
              <span>{ar ? `سلايد ${slide.position + 1}` : `Slide ${slide.position + 1}`}</span>
              {file.mimeType.startsWith("image/") ? <img src={`/api/files/${file.id}/download`} alt={`${content.title} slide ${slide.position + 1}`} /> : <a href={`/api/files/${file.id}/download`}>{ar ? "فتح السلايد" : "Open slide"}</a>}
            </div>;
          })}
        </div> : latestFile ? <div className="review-media-frame">
          {latestFile.mimeType.startsWith("video/") ? <video controls playsInline preload="metadata" src={`/api/files/${latestFile.id}/download`} /> : latestFile.mimeType.startsWith("image/") ? <img src={`/api/files/${latestFile.id}/download`} alt={content.title} /> : <a href={`/api/files/${latestFile.id}/download`}>{ar ? "فتح الملف" : "Open uploaded file"}</a>}
        </div> : <div className="review-empty"><b>{ar ? "ما في ملف مرفوع بعد." : "No visual uploaded yet."}</b><span>{ar ? "المونتير المعيّن بيرفع أول نسخة من هون." : "The assigned Editor can upload the first version below."}</span></div>}

        {latestVersion?.notes && <div className="feedback-box"><b>{ar ? "ملاحظة المونتير" : "Editor note"}</b><p>{latestVersion.notes}</p></div>}
        {latestRevision?.notes.map((note) => <div className="feedback-box revision-feedback" key={note.id}><b>{ar ? "آخر ملاحظة تعديل من العميل" : "Latest client revision note"}</b><p>{note.body}</p></div>)}
      </section>

      {workflow}

      <section className="panel">
        <div className="section-head"><div><span className="eyebrow">{ar ? "التفاصيل" : "DETAILS"}</span><h2>{content.type.replaceAll("_", " ")}</h2></div><span className="muted">{content.platform.join(" · ")}</span></div>
        <p>{ar ? "الموعد المخطط: " : "Planned: "}<b>{content.plannedAt?.toLocaleString() || (ar ? "غير مجدول" : "Not scheduled")}</b></p>
        {content.calendar && <p>{ar ? "التقويم: " : "Calendar: "}<b>{content.calendar.scheduledAt.toLocaleString()}</b></p>}
      </section>

      <section className="panel">
        <span className="eyebrow">{ar ? "آخر كابشن" : "LATEST CAPTION"}</span>
        <h2>{latestCaption ? `V${latestCaption.version}` : (ar ? "بانتظار مدير السوشيال ميديا" : "Waiting for Social Media Manager")}</h2>
        {latestCaption && <><p className="caption-preview">{latestCaption.caption}</p>{latestCaption.hashtags && <p className="muted">{latestCaption.hashtags}</p>}{latestCaption.cta && <p><b>CTA:</b> {latestCaption.cta}</p>}</>}
      </section>

      <section className="panel tablewrap">
        <span className="eyebrow">{ar ? "النسخ" : "VERSIONS"}</span><h2>{ar ? "سجل الإنتاج" : "Production history"}</h2>
        <table><thead><tr><th>{ar ? "النسخة" : "Version"}</th><th>{ar ? "رفعها" : "Uploaded by"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "ملاحظات" : "Notes"}</th><th>{ar ? "الملفات" : "Files"}</th></tr></thead><tbody>
          {content.versions.map((v) => <tr key={v.id}><td>V{v.version}</td><td>{v.uploadedBy.name}</td><td>{v.createdAt.toLocaleString()}</td><td>{v.notes || "—"}</td><td>{v.fileId ? <a href={`/api/files/${v.fileId}/download`}>{ar ? "فتح" : "Open"}</a> : v.slides.length ? `${v.slides.length} ${ar ? "سلايد" : "slides"}` : "—"}</td></tr>)}
        </tbody></table>
        {!content.versions.length && <p>{ar ? "ما في نسخ إنتاج بعد." : "No production versions yet."}</p>}
      </section>

      <section className="panel">
        <span className="eyebrow">{ar ? "الملاحظات" : "FEEDBACK"}</span><h2>{ar ? "سجل الموافقات" : "Approval history"}</h2>
        {content.approvals.length ? content.approvals.map((a) => <article className="approval-line" key={a.id}><div><b>{a.scope}</b><span>{s(a.state)}</span></div><small>{a.decidedAt?.toLocaleString() || a.createdAt.toLocaleString()}</small>{a.notes.map((n) => <p key={n.id}>{n.body}</p>)}</article>) : <p>{ar ? "ما في نشاط موافقات بعد." : "No approval activity yet."}</p>}
      </section>
    </div>
  </AppShell>;
}
