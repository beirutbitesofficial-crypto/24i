"use client";

import { FormEvent, useState } from "react";
import { Card, Notice } from "@/components/ui";

type FileOption = { id: string; name: string; mimeType: string };

type Props = {
  contentId: string;
  canWrite: boolean;
  canApprove: boolean;
  canSchedule: boolean;
  canUpload: boolean;
  isCarousel: boolean;
  hasVersion: boolean;
  hasCaption: boolean;
  readyToSchedule: boolean;
  files: FileOption[];
};

async function request(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.formErrors?.[0] || "Request failed");
  return data;
}

export function ContentWorkflow({ contentId, canWrite, canApprove, canSchedule, canUpload, isCarousel, hasVersion, hasCaption, readyToSchedule, files }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [slides, setSlides] = useState<string[]>([]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true); setMessage("");
    try { await fn(); setMessage(done); window.location.reload(); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Request failed"); }
    finally { setBusy(false); }
  }

  function caption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void run(() => request(`/api/content/${contentId}/captions`, { caption: f.get("caption"), hashtags: f.get("hashtags") || undefined, cta: f.get("cta") || undefined }), "Caption submitted for approval.");
  }
  function approve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void run(() => request("/api/approvals", { contentId, scope: f.get("scope"), decision: f.get("decision"), note: f.get("note") || undefined }), "Decision saved.");
  }
  function schedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const value = f.get("scheduledAt");
    void run(() => request(`/api/content/${contentId}/schedule`, { scheduledAt: value ? new Date(String(value)).toISOString() : value }), "Content scheduled.");
  }
  function version(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const notes = String(f.get("notes") || "").trim() || undefined;
    const body = isCarousel
      ? { notes, slides: slides.map((fileId, position) => ({ fileId, position })) }
      : { notes, fileId: String(f.get("fileId") || "") || undefined, thumbnailId: String(f.get("thumbnailId") || "") || undefined };
    void run(() => request(`/api/content/${contentId}/versions`, body), "Version submitted for approval.");
  }
  const toggleSlide = (id: string) => setSlides((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const images = files.filter((f) => f.mimeType.startsWith("image/"));
  const fileName = (id: string) => files.find((f) => f.id === id)?.name ?? id;

  const scopes = [
    hasVersion && { value: "VISUAL", label: "Visual / video" },
    hasCaption && { value: "CAPTION", label: "Caption" },
    hasVersion && hasCaption && { value: "ALL", label: "Visual and caption" },
  ].filter(Boolean) as { value: string; label: string }[];

  if (!canWrite && !canApprove && !canSchedule && !canUpload) return null;
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return <div className="management-stack">
    <Notice message={message} />
    {canApprove && <Card eyebrow="Client review" title="Approve or request a revision">
      {scopes.length
        ? <form className="form-grid compact-form" onSubmit={approve}>
            <label>What are you reviewing?<select name="scope">{scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
            <label>Decision<select name="decision"><option value="APPROVED">Approve</option><option value="REVISION_REQUESTED">Request revision</option></select></label>
            <label className="full-field">Note<textarea name="note" rows={3} placeholder="Required when requesting a revision" /></label>
            <button disabled={busy}>Submit decision</button>
          </form>
        : <p className="muted">Nothing has been submitted for review yet.</p>}
    </Card>}

    <div className="grid-2">
      {canUpload && <Card eyebrow="Production" title={isCarousel ? "Submit carousel version" : "Submit visual / video version"}>
        {files.length === 0
          ? <p className="muted">Upload the asset in <a href="/files">Files</a> first, then submit it here.</p>
          : <form className="compact-form" onSubmit={version}>
              {isCarousel
                ? <div className="slide-picker">
                    <span className="hint">Select images in slide order.</span>
                    <fieldset className="client-checks">{images.map((f) => <label className="check" key={f.id}><input type="checkbox" checked={slides.includes(f.id)} onChange={() => toggleSlide(f.id)} />{slides.includes(f.id) ? `${slides.indexOf(f.id) + 1}. ` : ""}{f.name}</label>)}</fieldset>
                    {slides.length > 0 && <ol>{slides.map((id) => <li key={id}>{fileName(id)}</li>)}</ol>}
                  </div>
                : <>
                    <label>Asset<select name="fileId" required defaultValue=""><option value="" disabled>Choose a file…</option>{files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
                    <label>Thumbnail (optional)<select name="thumbnailId" defaultValue=""><option value="">None</option>{images.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
                  </>}
              <label>Notes for the reviewer<textarea name="notes" rows={3} /></label>
              <button disabled={busy || (isCarousel && !slides.length)}>Submit for approval</button>
            </form>}
      </Card>}

      {canWrite && <Card eyebrow="Copy" title="Submit caption">
        <form className="compact-form" onSubmit={caption}>
          <label>Caption<textarea name="caption" rows={6} required /></label>
          <label>Hashtags<textarea name="hashtags" rows={2} placeholder="#brand #campaign" /></label>
          <label>Call to action<input name="cta" placeholder="Book now, link in bio…" /></label>
          <button disabled={busy}>Submit caption for approval</button>
        </form>
      </Card>}

      {canSchedule && <Card eyebrow="Publishing" title="Schedule">
        {readyToSchedule
          ? <form className="compact-form" onSubmit={schedule}><label>Date & time<input name="scheduledAt" type="datetime-local" min={now} required suppressHydrationWarning /></label><button disabled={busy}>Schedule</button></form>
          : <p className="muted">Scheduling unlocks once both the visual and caption are approved.</p>}
      </Card>}
    </div>
  </div>;
}
