"use client";

import { FormEvent, useState } from "react";

type Props = {
  contentId: string;
  clientId: string;
  currentVersion: number;
  currentCaptionVersion: number;
  canWrite: boolean;
  canApprove: boolean;
  canSchedule: boolean;
  canUpload: boolean;
  isCarousel: boolean;
  isClient: boolean;
  storageReady: boolean;
  visualStatus: string;
  contentStatus: string;
  captionText?: string | null;
  captionHashtags?: string | null;
  captionCta?: string | null;
  ar?: boolean;
};

async function request(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = typeof data.error === "string" ? data.error : data.error?.formErrors?.[0] || "Request failed";
    throw new Error(error);
  }
  return data;
}

export function ContentWorkflow({
  contentId, clientId, currentVersion, currentCaptionVersion, canWrite, canApprove, canSchedule, canUpload,
  isCarousel, isClient, storageReady, visualStatus, contentStatus, captionText, captionHashtags, captionCta, ar = false,
}: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientNote, setClientNote] = useState("");

  async function run(fn: () => Promise<unknown>, success = ar ? "تم الحفظ بنجاح." : "Saved successfully.") {
    setBusy(true); setMessage("");
    try {
      await fn();
      setMessage(success);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : ar ? "تعذّر تنفيذ الطلب" : "Request failed");
    } finally { setBusy(false); }
  }

  async function uploadAsset(file: File) {
    const mimeType = file.type || "application/octet-stream";
    const signRes = await fetch("/api/uploads/sign", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, name: file.name, type: mimeType, size: file.size }),
    });
    const signed = await signRes.json().catch(() => ({}));
    if (!signRes.ok) throw new Error(signed.error || (ar ? "تعذّر تجهيز الرفع." : "Could not prepare upload."));

    const putRes = await fetch(signed.url, { method: "PUT", headers: { "content-type": mimeType }, body: file });
    if (!putRes.ok) throw new Error(ar ? `فشل رفع ${file.name}.` : `Upload failed for ${file.name}.`);

    const completeRes = await fetch("/api/uploads/complete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, contentId, key: signed.key, originalName: file.name, mimeType, size: String(file.size) }),
    });
    const saved = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) throw new Error(saved.error || (ar ? "تعذّر تسجيل الملف المرفوع." : "Could not register uploaded file."));
    return saved.id as string;
  }

  function caption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(
      () => request(`/api/content/${contentId}/captions`, {
        caption: f.get("caption"), hashtags: f.get("hashtags") || undefined, cta: f.get("cta") || undefined,
      }),
      ar ? "تم إرسال الفيديو/التصميم مع الكابشن للعميل للموافقة." : "Visual + caption sent to the client for approval."
    );
  }

  function schedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = f.get("scheduledAt");
    void run(() => request(`/api/content/${contentId}/schedule`, { scheduledAt: value ? new Date(String(value)).toISOString() : value }));
  }

  function uploadVersion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const files = Array.from(input.files || []);
    const notes = String(data.get("notes") || "").trim();

    if (!files.length) {
      setMessage(isCarousel ? (ar ? "اختار صور الكاروسيل أولاً." : "Choose the carousel images first.") : (ar ? "اختار فيديو أو صورة أولاً." : "Choose a video or image first."));
      return;
    }

    void run(async () => {
      if (isCarousel) {
        const slides: { fileId: string; position: number }[] = [];
        for (let i = 0; i < files.length; i += 1) {
          const fileId = await uploadAsset(files[i]);
          slides.push({ fileId, position: i });
        }
        await request(`/api/content/${contentId}/versions`, { slides, notes: notes || undefined });
      } else {
        if (files.length !== 1) throw new Error(ar ? "اختار ملف واحد لهذا النوع من المحتوى." : "Choose one file for this content type.");
        const fileId = await uploadAsset(files[0]);
        await request(`/api/content/${contentId}/versions`, { fileId, notes: notes || undefined });
      }
    }, ar ? `تم رفع V${currentVersion + 1}. وصل إشعار لمدير السوشيال ميديا ليضيف الكابشن.` : `V${currentVersion + 1} uploaded. The Social Media Manager was notified to add the caption.`);
  }

  function clientDecision(decision: "APPROVED" | "REVISION_REQUESTED") {
    if (decision === "REVISION_REQUESTED" && !clientNote.trim()) {
      setMessage(ar ? "اكتب ملاحظتك قبل طلب التعديل." : "Please write what needs to change before requesting a revision.");
      return;
    }
    void run(
      () => request("/api/approvals", { contentId, scope: "ALL", decision, note: clientNote.trim() || undefined }),
      decision === "APPROVED"
        ? (ar ? "تمت الموافقة على المحتوى والكابشن. وصل إشعار للمونتير ومدير السوشيال ميديا." : "Visual and caption approved. The Editor and Social Media Manager were notified.")
        : (ar ? "تم طلب التعديل وإرسال ملاحظتك للفريق." : "Revision requested. Your notes were sent to the Editor and Social Media Manager.")
    );
  }

  if (!canWrite && !canApprove && !canSchedule && !canUpload) return null;
  const readyForClient = isClient && canApprove && contentStatus === "WAITING_CLIENT_APPROVAL" && currentVersion > 0 && currentCaptionVersion > 0 && !!captionText;

  return <div className="management-stack">
    {message && <div className="notice">{message}</div>}

    {canUpload && <section className="panel">
      <span className="eyebrow">{ar ? "الإنتاج" : "PRODUCTION"}</span>
      <h2>{isCarousel ? (ar ? "رفع كاروسيل" : "Upload carousel") : (ar ? "رفع Reel / Post" : "Upload reel / post visual")}</h2>
      <p className="muted">{ar ? "بعد الرفع، الإشعار يروح أولاً لمدير السوشيال ميديا. العميل ما بيتنبّه إلا لما الكابشن يصير جاهز." : "After upload, the Social Media Manager gets the notification first. The client is notified only after the caption is ready."}</p>
      {!storageReady && <div className="notice">{ar ? "التخزين مش مجهّز بعد، لذلك الرفع المباشر متوقف مؤقتاً." : "Storage is not configured yet, so direct upload is temporarily disabled."}</div>}
      <form className="compact-form upload-version-form" onSubmit={uploadVersion}>
        <label>{isCarousel ? (ar ? "صور الكاروسيل" : "Carousel images") : (ar ? "فيديو أو صورة" : "Video or image")}
          <input name="file" type="file" accept={isCarousel ? "image/*" : "video/*,image/*"} multiple={isCarousel} required />
        </label>
        <label>{ar ? "ملاحظات النسخة" : "Version notes"}<textarea name="notes" rows={3} placeholder={ar ? "ملاحظة اختيارية للفريق" : "Optional production note"} /></label>
        <button disabled={busy || !storageReady}>{busy ? (ar ? "جارٍ الرفع…" : "Uploading…") : (ar ? `رفع V${currentVersion + 1} وإرسالها للـ SMM` : `Upload V${currentVersion + 1} & send to SMM`)}</button>
      </form>
    </section>}

    {canWrite && !isClient && <section className="panel">
      <span className="eyebrow">{ar ? "السوشيال ميديا" : "SOCIAL MEDIA"}</span>
      <h2>{ar ? "أضف الكابشن وأرسل المحتوى كاملاً للعميل" : "Add caption & send full content to client"}</h2>
      {currentVersion < 1 && <div className="notice">{ar ? "بانتظار المونتير يرفع الفيديو/التصميم أولاً." : "Waiting for the Editor to upload the visual first."}</div>}
      <form className="compact-form" onSubmit={caption}>
        <label>{ar ? "الكابشن" : "Caption"}<textarea name="caption" rows={6} defaultValue={captionText || ""} required /></label>
        <label>{ar ? "الهاشتاغات" : "Hashtags"}<textarea name="hashtags" rows={2} defaultValue={captionHashtags || ""} /></label>
        <label>CTA<input name="cta" defaultValue={captionCta || ""} /></label>
        <button disabled={busy || currentVersion < 1}>{busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال الفيديو/التصميم + الكابشن للعميل" : "Send visual + caption to client")}</button>
      </form>
    </section>}

    {isClient && canApprove && <section className="panel client-review-card">
      <span className="eyebrow">{ar ? "موافقتك" : "YOUR APPROVAL"}</span>
      {readyForClient ? <>
        <h2>{ar ? "راجع المحتوى والكابشن سوا" : "Review visual + caption together"}</h2>
        <div className="client-caption-preview">
          <span className="muted">{ar ? `الكابشن V${currentCaptionVersion}` : `Caption V${currentCaptionVersion}`}</span>
          <p>{captionText}</p>
          {captionHashtags && <p className="muted">{captionHashtags}</p>}
          {captionCta && <p><b>CTA:</b> {captionCta}</p>}
        </div>
        <label>{ar ? "ملاحظات التعديل" : "Revision notes"}<textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)} rows={4} placeholder={ar ? "مطلوبة فقط إذا بدك تعديل" : "Only required if you want changes"} /></label>
        <div className="review-actions">
          <button type="button" disabled={busy} onClick={() => clientDecision("APPROVED")}>{ar ? "موافق على المحتوى + الكابشن" : "Approve visual + caption"}</button>
          <button type="button" className="revision-button" disabled={busy} onClick={() => clientDecision("REVISION_REQUESTED")}>{ar ? "طلب تعديل" : "Request revision"}</button>
        </div>
      </> : <>
        <h2>{visualStatus === "APPROVED" ? (ar ? "تمت الموافقة" : "Approved") : (ar ? "لسه مش جاهز للموافقة" : "Not ready for approval yet")}</h2>
        <p className="muted">{ar ? "مدير السوشيال ميديا رح يرسللك الفيديو/التصميم مع الكابشن لما يصيروا جاهزين." : "The Social Media Manager will send the complete visual + caption package when it is ready."}</p>
      </>}
    </section>}

    {canSchedule && <section className="panel"><span className="eyebrow">{ar ? "النشر" : "PUBLISHING"}</span><h2>{ar ? "جدولة المحتوى الموافق عليه" : "Schedule approved content"}</h2><form className="form-grid compact-form" onSubmit={schedule}><label>{ar ? "التاريخ والوقت" : "Date & time"}<input name="scheduledAt" type="datetime-local" required /></label><button disabled={busy}>{ar ? "جدولة" : "Schedule"}</button></form></section>}
  </div>;
}
