"use client";

import { FormEvent, useState } from "react";

type Props = {
  contentId: string;
  canWrite: boolean;
  canApprove: boolean;
  canSchedule: boolean;
  canUpload: boolean;
  isCarousel: boolean;
};

async function request(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data;
}

export function ContentWorkflow({ contentId, canWrite, canApprove, canSchedule, canUpload, isCarousel }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setMessage("");
    try { await fn(); setMessage("Saved successfully."); window.location.reload(); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Request failed"); }
    finally { setBusy(false); }
  }

  function caption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void run(() => request(`/api/content/${contentId}/captions`, { caption: f.get("caption"), hashtags: f.get("hashtags") || undefined, cta: f.get("cta") || undefined }));
  }
  function approve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void run(() => request("/api/approvals", { contentId, scope: f.get("scope"), decision: f.get("decision"), note: f.get("note") || undefined }));
  }
  function schedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const value = f.get("scheduledAt");
    void run(() => request(`/api/content/${contentId}/schedule`, { scheduledAt: value ? new Date(String(value)).toISOString() : value }));
  }
  function version(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const fileId = String(f.get("fileId") || "").trim();
    const notes = String(f.get("notes") || "").trim();
    void run(() => request(`/api/content/${contentId}/versions`, { fileId: fileId || undefined, notes: notes || undefined, ...(isCarousel ? { slides: [] } : {}) }));
  }

  if (!canWrite && !canApprove && !canSchedule && !canUpload) return null;
  return <div className="management-stack">{message && <div className="notice">{message}</div>}
    {canWrite && <section className="panel"><span className="eyebrow">COPY</span><h2>Submit caption</h2><form className="compact-form" onSubmit={caption}><label>Caption<textarea name="caption" rows={6} required /></label><label>Hashtags<textarea name="hashtags" rows={2} /></label><label>CTA<input name="cta" /></label><button disabled={busy}>Submit caption for approval</button></form></section>}
    {canUpload && !isCarousel && <section className="panel"><span className="eyebrow">PRODUCTION</span><h2>Submit visual / reel version</h2><p className="muted">Use the File ID from the file library. Direct upload will use the configured storage service.</p><form className="compact-form" onSubmit={version}><label>File ID<input name="fileId" /></label><label>Revision / production notes<textarea name="notes" rows={3} /></label><button disabled={busy}>Submit version for approval</button></form></section>}
    {canApprove && <section className="panel"><span className="eyebrow">CLIENT REVIEW</span><h2>Approve or request revision</h2><form className="form-grid compact-form" onSubmit={approve}><label>Scope<select name="scope"><option value="VISUAL">Visual / video</option><option value="CAPTION">Caption</option><option value="ALL">All</option></select></label><label>Decision<select name="decision"><option value="APPROVED">Approve</option><option value="REVISION_REQUESTED">Request revision</option></select></label><label className="full-field">Note<textarea name="note" rows={3} placeholder="Required when requesting a revision" /></label><button disabled={busy}>Submit decision</button></form></section>}
    {canSchedule && <section className="panel"><span className="eyebrow">PUBLISHING</span><h2>Schedule approved content</h2><form className="form-grid compact-form" onSubmit={schedule}><label>Date & time<input name="scheduledAt" type="datetime-local" required /></label><button disabled={busy}>Schedule</button></form></section>}
  </div>;
}
