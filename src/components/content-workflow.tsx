"use client";

import { FormEvent, useState } from "react";

type Props = {
  contentId: string;
  clientId: string;
  currentVersion: number;
  canWrite: boolean;
  canApprove: boolean;
  canSchedule: boolean;
  canUpload: boolean;
  isCarousel: boolean;
  isClient: boolean;
  storageReady: boolean;
  visualStatus: string;
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

export function ContentWorkflow({ contentId, clientId, currentVersion, canWrite, canApprove, canSchedule, canUpload, isCarousel, isClient, storageReady, visualStatus }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientNote, setClientNote] = useState("");

  async function run(fn: () => Promise<unknown>, success = "Saved successfully.") {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(success);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function caption(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(() => request(`/api/content/${contentId}/captions`, { caption: f.get("caption"), hashtags: f.get("hashtags") || undefined, cta: f.get("cta") || undefined }), "Caption sent for approval.");
  }

  function approve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void run(() => request("/api/approvals", { contentId, scope: f.get("scope"), decision: f.get("decision"), note: f.get("note") || undefined }));
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
    const file = input.files?.[0];
    const notes = String(data.get("notes") || "").trim();

    if (!file) {
      setMessage("Choose a video or image first.");
      return;
    }

    void run(async () => {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, name: file.name, type: file.type, size: file.size }),
      });
      const signed = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(signed.error || "Could not prepare upload.");

      const putRes = await fetch(signed.url, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!putRes.ok) throw new Error("Video upload failed.");

      const completeRes = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, contentId, key: signed.key, originalName: file.name, mimeType: file.type, size: String(file.size) }),
      });
      const saved = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) throw new Error(saved.error || "Could not register uploaded file.");

      await request(`/api/content/${contentId}/versions`, { fileId: saved.id, notes: notes || undefined });
    }, `V${currentVersion + 1} uploaded and sent to the client for approval.`);
  }

  function clientDecision(decision: "APPROVED" | "REVISION_REQUESTED") {
    if (decision === "REVISION_REQUESTED" && !clientNote.trim()) {
      setMessage("Please write what needs to change before requesting a revision.");
      return;
    }
    void run(
      () => request("/api/approvals", { contentId, scope: "VISUAL", decision, note: clientNote.trim() || undefined }),
      decision === "APPROVED" ? "Approved. The editor and social media manager were notified." : "Revision requested. Your notes were sent to the team."
    );
  }

  if (!canWrite && !canApprove && !canSchedule && !canUpload) return null;

  return <div className="management-stack">
    {message && <div className="notice">{message}</div>}

    {canUpload && !isCarousel && <section className="panel">
      <span className="eyebrow">PRODUCTION</span>
      <h2>Upload video / visual</h2>
      <p className="muted">The client receives a notification as soon as you submit a new version.</p>
      {!storageReady && <div className="notice">Storage is not configured yet, so direct upload is temporarily disabled.</div>}
      <form className="compact-form upload-version-form" onSubmit={uploadVersion}>
        <label>Video or image<input name="file" type="file" accept="video/*,image/*" required /></label>
        <label>Version notes<textarea name="notes" rows={3} placeholder="Optional note for this version" /></label>
        <button disabled={busy || !storageReady}>{busy ? "Uploading…" : `Upload V${currentVersion + 1} & send to client`}</button>
      </form>
    </section>}

    {canWrite && <section className="panel">
      <span className="eyebrow">COPY</span><h2>Submit caption</h2>
      <form className="compact-form" onSubmit={caption}><label>Caption<textarea name="caption" rows={6} required /></label><label>Hashtags<textarea name="hashtags" rows={2} /></label><label>CTA<input name="cta" /></label><button disabled={busy}>Submit caption for approval</button></form>
    </section>}

    {isClient && canApprove && <section className="panel client-review-card">
      <span className="eyebrow">YOUR REVIEW</span>
      <h2>{visualStatus === "WAITING" ? "Approve this video?" : visualStatus.replaceAll("_", " ")}</h2>
      {visualStatus === "WAITING" ? <>
        <label>Notes<textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)} rows={4} placeholder="Only required if you want changes" /></label>
        <div className="review-actions">
          <button type="button" disabled={busy} onClick={() => clientDecision("APPROVED")}>Approve</button>
          <button type="button" className="revision-button" disabled={busy} onClick={() => clientDecision("REVISION_REQUESTED")}>Request revision</button>
        </div>
      </> : <p className="muted">Your latest decision is saved. You’ll be notified when a new version is ready.</p>}
    </section>}

    {!isClient && canApprove && <section className="panel"><span className="eyebrow">REVIEW</span><h2>Approve or request revision</h2><form className="form-grid compact-form" onSubmit={approve}><label>Scope<select name="scope"><option value="VISUAL">Visual / video</option><option value="CAPTION">Caption</option><option value="ALL">All</option></select></label><label>Decision<select name="decision"><option value="APPROVED">Approve</option><option value="REVISION_REQUESTED">Request revision</option></select></label><label className="full-field">Note<textarea name="note" rows={3} placeholder="Required when requesting a revision" /></label><button disabled={busy}>Submit decision</button></form></section>}

    {canSchedule && <section className="panel"><span className="eyebrow">PUBLISHING</span><h2>Schedule approved content</h2><form className="form-grid compact-form" onSubmit={schedule}><label>Date & time<input name="scheduledAt" type="datetime-local" required /></label><button disabled={busy}>Schedule</button></form></section>}
  </div>;
}
