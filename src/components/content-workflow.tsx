"use client";

import { FormEvent, useState } from "react";
import { fastStart } from "@/lib/faststart";
import { storageUploadError } from "@/lib/upload-client";

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
  isSocialMediaManager: boolean;
  storageReady: boolean;
  visualStatus: string;
  contentStatus: string;
  captionText?: string | null;
  captionHashtags?: string | null;
  captionCta?: string | null;
  ar?: boolean;
  scheduledAt?: string | null;
};

async function request(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = typeof data.error === "string" ? data.error : data.error?.formErrors?.[0] || "Request failed";
    throw new Error(error);
  }
  return data;
}

function putFileWithProgress(
  url: string,
  file: File,
  mimeType: string,
  onProgress: (loaded: number, total: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(file.size, file.size);
        resolve();
      } else {
        reject(new Error(storageUploadError(xhr.status, document.documentElement.lang === "ar" || document.querySelector("[data-language=ar]") !== null)));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

// datetime-local inputs work in the viewer's local time.
function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const minLocal = () => toLocalInput(new Date(Date.now() + 5 * 60_000).toISOString());

export function ContentWorkflow({
  contentId,
  clientId,
  currentVersion,
  currentCaptionVersion,
  canWrite,
  canApprove,
  canSchedule,
  canUpload,
  isCarousel,
  isClient,
  isSocialMediaManager,
  storageReady,
  visualStatus,
  contentStatus,
  captionText,
  captionHashtags,
  captionCta,
  ar = false,
  scheduledAt = null,
}: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientNote, setClientNote] = useState("");
  // Client review steps: pick what is wrong, then either write notes or (for the caption) fix it directly.
  type RevisionStep = "none" | "choose" | "VISUAL" | "CAPTION_CHOICE" | "CAPTION_NOTES" | "CAPTION_EDIT" | "ALL";
  const [revision, setRevision] = useState<RevisionStep>("none");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");

  async function run(
    fn: () => Promise<unknown>,
    success = ar ? "تم الحفظ بنجاح." : "Saved successfully."
  ) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(success);
      window.location.reload();
    } catch (err) {
      setUploadProgress(null);
      setUploadLabel("");
      setMessage(err instanceof Error ? err.message : ar ? "تعذّر تنفيذ الطلب" : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAsset(original: File, onProgress?: (loaded: number, total: number) => void) {
    // Move the video index to the front so the review player can start without downloading the whole file.
    const file = await fastStart(original);
    const mimeType = file.type || "application/octet-stream";
    const signRes = await fetch("/api/uploads/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, name: file.name, type: mimeType, size: file.size }),
    });
    const signed = await signRes.json().catch(() => ({}));
    if (!signRes.ok) throw new Error(signed.error || (ar ? "تعذّر تجهيز الرفع." : "Could not prepare upload."));

    await putFileWithProgress(signed.url, file, mimeType, (loaded, total) => onProgress?.(loaded, total));

    const completeRes = await fetch("/api/uploads/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId,
        contentId,
        key: signed.key,
        originalName: file.name,
        mimeType,
        size: String(file.size),
      }),
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
        caption: f.get("caption"),
        hashtags: f.get("hashtags") || undefined,
        cta: f.get("cta") || undefined,
      }),
      ar ? "تم إرسال الفيديو/التصميم مع الكابشن للعميل للموافقة." : "Visual + caption sent to the client for approval."
    );
  }

  function schedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = f.get("scheduledAt");
    void run(() => request(`/api/content/${contentId}/schedule`, {
      scheduledAt: value ? new Date(String(value)).toISOString() : value,
    }));
  }

  function uploadVersion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const files = Array.from(input.files || []);
    const notes = String(data.get("notes") || "").trim();
    const directCaption = isSocialMediaManager ? String(data.get("caption") || "").trim() : "";
    const directHashtags = isSocialMediaManager ? String(data.get("hashtags") || "").trim() : "";
    const directCta = isSocialMediaManager ? String(data.get("cta") || "").trim() : "";

    if (isSocialMediaManager && !directCaption) {
      setMessage(ar ? "اكتب الكابشن قبل إرسال المحتوى للعميل." : "Add the caption before sending the content to the client.");
      return;
    }

    if (!files.length) {
      setMessage(isCarousel
        ? (ar ? "اختار صور الكاروسيل أولاً." : "Choose the carousel images first.")
        : (ar ? "اختار فيديو أو صورة أولاً." : "Choose a video or image first."));
      return;
    }

    setUploadProgress(0);
    setUploadLabel(ar ? "بدء الرفع…" : "Starting upload…");

    void run(async () => {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0) || 1;
      let completedBytes = 0;

      if (isCarousel) {
        const slides: { fileId: string; position: number }[] = [];
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          setUploadLabel(ar ? `رفع صورة ${i + 1} من ${files.length}` : `Uploading image ${i + 1} of ${files.length}`);
          const fileId = await uploadAsset(file, (loaded) => {
            const percent = Math.round(((completedBytes + loaded) / totalBytes) * 100);
            setUploadProgress(Math.min(99, Math.max(0, percent)));
          });
          completedBytes += file.size;
          setUploadProgress(Math.min(99, Math.round((completedBytes / totalBytes) * 100)));
          slides.push({ fileId, position: i });
        }
        setUploadLabel(ar ? "تسجيل النسخة…" : "Finalizing version…");
        await request(`/api/content/${contentId}/versions`, {
          slides,
          notes: notes || undefined,
          ...(isSocialMediaManager ? {
            caption: directCaption,
            hashtags: directHashtags || undefined,
            cta: directCta || undefined,
          } : {}),
        });
      } else {
        if (files.length !== 1) throw new Error(ar ? "اختار ملف واحد لهذا النوع من المحتوى." : "Choose one file for this content type.");
        const file = files[0];
        setUploadLabel(ar ? "جارٍ رفع الملف" : "Uploading file");
        const fileId = await uploadAsset(file, (loaded) => {
          const percent = Math.round((loaded / totalBytes) * 100);
          setUploadProgress(Math.min(99, Math.max(0, percent)));
        });
        setUploadLabel(ar ? "تسجيل النسخة…" : "Finalizing version…");
        await request(`/api/content/${contentId}/versions`, {
          fileId,
          notes: notes || undefined,
          ...(isSocialMediaManager ? {
            caption: directCaption,
            hashtags: directHashtags || undefined,
            cta: directCta || undefined,
          } : {}),
        });
      }

      setUploadProgress(100);
      setUploadLabel(ar ? "اكتمل الرفع" : "Upload complete");
    }, isSocialMediaManager
      ? (ar
          ? `تم رفع V${currentVersion + 1} مع الكابشن وإرسالها للعميل للموافقة.`
          : `V${currentVersion + 1} uploaded with the caption and sent to the client for approval.`)
      : (ar
          ? `تم رفع V${currentVersion + 1}. وصل إشعار لمدير السوشيال ميديا ليضيف الكابشن.`
          : `V${currentVersion + 1} uploaded. The Social Media Manager was notified to add the caption.`));
  }

  function clientEditCaption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(
      () => request(`/api/content/${contentId}/client-caption`, {
        caption: f.get("caption"),
        hashtags: String(f.get("hashtags") || "").trim() || undefined,
        cta: String(f.get("cta") || "").trim() || undefined,
      }),
      ar ? "تم حفظ الكابشن والموافقة على المحتوى." : "Caption saved and content approved.",
    );
  }

  function clientDecision(decision: "APPROVED" | "REVISION_REQUESTED", scope: "ALL" | "VISUAL" | "CAPTION" = "ALL") {
    if (decision === "REVISION_REQUESTED" && !clientNote.trim()) {
      setMessage(ar ? "اكتب ملاحظتك قبل إرسال طلب التعديل." : "Write your notes before sending the revision request.");
      return;
    }

    void run(
      () => request("/api/approvals", {
        contentId,
        scope,
        decision,
        note: clientNote.trim() || undefined,
      }),
      decision === "APPROVED"
        ? (ar
            ? "تمت الموافقة. وصل إشعار للمدير والمونتير ومدير السوشيال ميديا."
            : "Approved. The Manager, Editor and Social Media Manager were notified.")
        : scope === "VISUAL"
          ? (ar ? "تم إرسال ملاحظاتك للمونتير ليعدّل الفيديو." : "Your notes were sent to the editor to update the video.")
          : scope === "CAPTION"
            ? (ar ? "تم إرسال ملاحظاتك لمدير السوشيال ميديا ليعدّل الكابشن." : "Your notes were sent to the Social Media Manager to update the caption.")
            : (ar ? "تم إرسال ملاحظاتك للمونتير ومدير السوشيال ميديا." : "Your notes were sent to the editor and the Social Media Manager.")
    );
  }

  if (!canWrite && !canApprove && !canSchedule && !canUpload) return null;

  const readyForClient =
    isClient &&
    canApprove &&
    contentStatus === "WAITING_CLIENT_APPROVAL" &&
    currentVersion > 0 &&
    currentCaptionVersion > 0 &&
    !!captionText;

  return (
    <div className="management-stack">
      {message && <div className="notice">{message}</div>}

      {canUpload && (
        <section className="panel">
          <span className="eyebrow">{ar ? "الإنتاج" : "PRODUCTION"}</span>
          <h2>{isCarousel ? (ar ? "رفع كاروسيل" : "Upload carousel") : (ar ? "رفع Reel / Post" : "Upload reel / post visual")}</h2>
          <p className="muted">
            {isSocialMediaManager
              ? (ar
                  ? "ارفع الفيديو/التصميم مع الكابشن. بعد اكتمال الرفع، يوصل إشعار للعميل مباشرة للموافقة."
                  : "Upload the visual with the caption. When the upload finishes, the client is notified immediately for approval.")
              : (ar
                  ? "بعد الرفع، الإشعار يروح أولاً لمدير السوشيال ميديا. العميل ما بيتنبّه إلا لما الكابشن يصير جاهز."
                  : "After upload, the Social Media Manager gets the notification first. The client is notified only after the caption is ready.")}
          </p>
          {!storageReady && <div className="notice">{ar ? "التخزين مش مجهّز بعد، لذلك الرفع المباشر متوقف مؤقتاً." : "Storage is not configured yet, so direct upload is temporarily disabled."}</div>}
          <form className="compact-form upload-version-form" onSubmit={uploadVersion}>
            <label>
              {isCarousel ? (ar ? "صور الكاروسيل" : "Carousel images") : (ar ? "فيديو أو صورة" : "Video or image")}
              <input name="file" type="file" accept={isCarousel ? "image/*" : "video/*,image/*"} multiple={isCarousel} required />
            </label>
            <label>
              {ar ? "ملاحظات النسخة" : "Version notes"}
              <textarea name="notes" rows={3} placeholder={ar ? "ملاحظة اختيارية للفريق" : "Optional production note"} />
            </label>

            {isSocialMediaManager && <>
              <label>{ar ? "الكابشن" : "Caption"}<textarea name="caption" rows={6} defaultValue={captionText || ""} required /></label>
              <label>{ar ? "الهاشتاغات" : "Hashtags"}<textarea name="hashtags" rows={2} defaultValue={captionHashtags || ""} /></label>
              <label>CTA<input name="cta" defaultValue={captionCta || ""} /></label>
            </>}

            {uploadProgress !== null && (
              <div style={{ display: "grid", gap: 7 }} aria-live="polite">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span className="muted">{uploadLabel}</span>
                  <strong>{uploadProgress}%</strong>
                </div>
                <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "var(--line)" }}>
                  <div style={{
                    height: "100%",
                    width: `${uploadProgress}%`,
                    borderRadius: 999,
                    background: "linear-gradient(90deg, var(--green), var(--lime))",
                    transition: "width .16s ease",
                  }} />
                </div>
              </div>
            )}

            <button disabled={busy || !storageReady}>
              {uploadProgress !== null && busy
                ? (ar ? `جارٍ الرفع… ${uploadProgress}%` : `Uploading… ${uploadProgress}%`)
                : busy
                  ? (ar ? "جارٍ الرفع…" : "Uploading…")
                  : isSocialMediaManager
                    ? (ar ? `رفع V${currentVersion + 1} + الكابشن وإرسالها للعميل` : `Upload V${currentVersion + 1} + caption & send to client`)
                    : (ar ? `رفع V${currentVersion + 1} وإرسالها للـ SMM` : `Upload V${currentVersion + 1} & send to SMM`)}
            </button>
          </form>
        </section>
      )}

      {canWrite && !isClient && (
        <section className="panel">
          <span className="eyebrow">{ar ? "السوشيال ميديا" : "SOCIAL MEDIA"}</span>
          <h2>{ar ? "أضف الكابشن وأرسل المحتوى كاملاً للعميل" : "Add caption & send full content to client"}</h2>
          {currentVersion < 1 && <div className="notice">{ar ? "بانتظار المونتير يرفع الفيديو/التصميم أولاً." : "Waiting for the Editor to upload the visual first."}</div>}
          <form className="compact-form" onSubmit={caption}>
            <label>{ar ? "الكابشن" : "Caption"}<textarea name="caption" rows={6} defaultValue={captionText || ""} required /></label>
            <label>{ar ? "الهاشتاغات" : "Hashtags"}<textarea name="hashtags" rows={2} defaultValue={captionHashtags || ""} /></label>
            <label>CTA<input name="cta" defaultValue={captionCta || ""} /></label>
            <button disabled={busy || currentVersion < 1}>
              {busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال الفيديو/التصميم + الكابشن للعميل" : "Send visual + caption to client")}
            </button>
          </form>
        </section>
      )}

      {isClient && canApprove && (
        <section className="panel client-review-card">
          <span className="eyebrow">{ar ? "موافقتك" : "YOUR APPROVAL"}</span>
          {readyForClient ? (
            <>
              <h2>{ar ? "راجع الفيديو/التصميم والكابشن" : "Review visual + caption"}</h2>
              <div className="client-caption-preview">
                <span className="muted">{ar ? `الكابشن V${currentCaptionVersion}` : `Caption V${currentCaptionVersion}`}</span>
                <p>{captionText}</p>
                {captionHashtags && <p className="muted">{captionHashtags}</p>}
                {captionCta && <p><b>CTA:</b> {captionCta}</p>}
              </div>

              {revision === "none" && (
                <div className="review-actions">
                  <button type="button" disabled={busy} onClick={() => clientDecision("APPROVED")}>
                    {ar ? "موافق" : "Approve"}
                  </button>
                  <button type="button" className="revision-button" disabled={busy} onClick={() => { setMessage(""); setRevision("choose"); }}>
                    {ar ? "غير موافق / طلب تعديل" : "Not approved / Request changes"}
                  </button>
                </div>
              )}

              {revision === "choose" && (
                <div className="panel revision-feedback">
                  <span className="eyebrow">{ar ? "طلب تعديل" : "Request changes"}</span>
                  <h3>{ar ? "شو بدك يتعدّل؟" : "What needs to change?"}</h3>
                  <div className="choice-list">
                    <button type="button" className="secondary" onClick={() => setRevision("VISUAL")}>🎬 {ar ? "الفيديو / التصميم" : "The video / design"}</button>
                    <button type="button" className="secondary" onClick={() => setRevision("CAPTION_CHOICE")}>✍️ {ar ? "الكابشن / الهاشتاغ" : "The caption / hashtags"}</button>
                    <button type="button" className="secondary" onClick={() => setRevision("ALL")}>🔁 {ar ? "الاتنين" : "Both"}</button>
                  </div>
                  <button type="button" className="secondary" onClick={() => setRevision("none")}>{ar ? "رجوع" : "Back"}</button>
                </div>
              )}

              {revision === "CAPTION_CHOICE" && (
                <div className="panel revision-feedback">
                  <span className="eyebrow">{ar ? "تعديل الكابشن" : "Caption changes"}</span>
                  <h3>{ar ? "كيف بدك تعدّل الكابشن؟" : "How do you want to change the caption?"}</h3>
                  <div className="choice-list">
                    <button type="button" className="secondary" onClick={() => setRevision("CAPTION_EDIT")}>✏️ {ar ? "بعدّلو أنا وبوافق" : "I'll edit it myself and approve"}</button>
                    <button type="button" className="secondary" onClick={() => setRevision("CAPTION_NOTES")}>💬 {ar ? "بعت ملاحظة لمدير السوشيال ميديا" : "Send notes to the Social Media Manager"}</button>
                  </div>
                  <button type="button" className="secondary" onClick={() => setRevision("choose")}>{ar ? "رجوع" : "Back"}</button>
                </div>
              )}

              {revision === "CAPTION_EDIT" && (
                <form className="panel revision-feedback compact-form" onSubmit={clientEditCaption}>
                  <span className="eyebrow">{ar ? "عدّل الكابشن" : "Edit the caption"}</span>
                  <label>{ar ? "الكابشن" : "Caption"}<textarea name="caption" rows={6} defaultValue={captionText ?? ""} required autoFocus /></label>
                  <label>{ar ? "الهاشتاغ" : "Hashtags"}<textarea name="hashtags" rows={2} defaultValue={captionHashtags ?? ""} /></label>
                  <label>CTA<input name="cta" defaultValue={captionCta ?? ""} /></label>
                  <p className="muted">{ar ? "بس تحفظ، بتكون وافقت على المحتوى وبينزل حسب الموعد." : "Saving also approves the content, and it will be published as planned."}</p>
                  <div className="review-actions">
                    <button disabled={busy}>{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "احفظ ووافق" : "Save & approve")}</button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => setRevision("CAPTION_CHOICE")}>{ar ? "رجوع" : "Back"}</button>
                  </div>
                </form>
              )}

              {(revision === "VISUAL" || revision === "CAPTION_NOTES" || revision === "ALL") && (
                <div className="panel revision-feedback">
                  <span className="eyebrow">{ar ? "ملاحظات التعديل" : "Revision notes"}</span>
                  <h3>{revision === "VISUAL"
                    ? (ar ? "شو بدك يتغيّر بالفيديو/التصميم؟" : "What should change in the video/design?")
                    : revision === "CAPTION_NOTES"
                      ? (ar ? "شو بدك يتغيّر بالكابشن؟" : "What should change in the caption?")
                      : (ar ? "شو بدك يتغيّر بالفيديو والكابشن؟" : "What should change in the video and the caption?")}</h3>
                  <p className="muted">{revision === "VISUAL"
                    ? (ar ? "ملاحظتك رح توصل للمونتير." : "Your note goes to the editor.")
                    : revision === "CAPTION_NOTES"
                      ? (ar ? "ملاحظتك رح توصل لمدير السوشيال ميديا." : "Your note goes to the Social Media Manager.")
                      : (ar ? "ملاحظتك رح توصل للمونتير ومدير السوشيال ميديا." : "Your note goes to the editor and the Social Media Manager.")}</p>
                  <textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)} rows={5} autoFocus placeholder={ar ? "اكتب الملاحظات بوضوح…" : "Write the requested changes clearly…"} />
                  <div className="review-actions">
                    <button type="button" className="revision-button" disabled={busy || !clientNote.trim()} onClick={() => clientDecision("REVISION_REQUESTED", revision === "VISUAL" ? "VISUAL" : revision === "CAPTION_NOTES" ? "CAPTION" : "ALL")}>
                      {busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال الملاحظات" : "Send notes")}
                    </button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => { setRevision(revision === "CAPTION_NOTES" ? "CAPTION_CHOICE" : "choose"); setMessage(""); }}>
                      {ar ? "رجوع" : "Back"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <h2>
                {visualStatus === "APPROVED"
                  ? (ar ? "تمت الموافقة" : "Approved")
                  : (ar ? "لسه مش جاهز للموافقة" : "Not ready for approval yet")}
              </h2>
              <p className="muted">
                {ar
                  ? "مدير السوشيال ميديا رح يرسللك الفيديو/التصميم مع الكابشن لما يصيروا جاهزين."
                  : "The Social Media Manager will send the complete visual + caption package when it is ready."}
              </p>
            </>
          )}
        </section>
      )}

      {canSchedule && (
        <section className="panel">
          <span className="eyebrow">{ar ? "النشر" : "Publishing"}</span>
          <h2>{ar ? "موعد النشر" : "Publish date & time"}</h2>
          <p className="muted">{scheduledAt
            ? (ar ? `رح ينزل البوست بـ ${new Date(scheduledAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })} بعد موافقة العميل.` : `Publishes on ${new Date(scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} once the client approves.`)
            : (ar ? "بلا موعد، البوست بينزل فوراً بعد موافقة العميل. حدد موعد إذا بدك ينزل بوقت معيّن." : "Without a time, the post goes out right after the client approves. Set a time to publish later.")}</p>
          <form className="form-grid compact-form" onSubmit={schedule}>
            <label>{ar ? "التاريخ والوقت" : "Date & time"}<input name="scheduledAt" type="datetime-local" required min={minLocal()} defaultValue={scheduledAt ? toLocalInput(scheduledAt) : undefined} suppressHydrationWarning /></label>
            <button disabled={busy}>{scheduledAt ? (ar ? "غيّر الموعد" : "Change time") : (ar ? "حدّد الموعد" : "Set publish time")}</button>
          </form>
        </section>
      )}
    </div>
  );
}
