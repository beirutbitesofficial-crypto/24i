"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApprovalActions({ contentId }: { contentId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "REVISION_REQUESTED" | null>(null);
  const [message, setMessage] = useState("");

  async function submit(decision: "APPROVED" | "REVISION_REQUESTED") {
    if (decision === "REVISION_REQUESTED" && !note.trim()) {
      setMessage("Please add a note explaining what needs to change.");
      return;
    }
    setBusy(decision);
    setMessage("");
    const res = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId, scope: "VISUAL", decision, note: note.trim() || undefined })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage(data?.error?.formErrors?.[0] || data?.error || "Could not save your decision.");
      setBusy(null);
      return;
    }
    setMessage(decision === "APPROVED" ? "Approved. The team has been notified." : "Revision requested. Your note was sent to the team.");
    setBusy(null);
    router.refresh();
  }

  return <div className="approval-actions">
    <label>Revision notes<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Tell the editor exactly what you want changed..." rows={5} /></label>
    {message && <p className="form-message">{message}</p>}
    <div className="approval-buttons">
      <button className="approve-btn" disabled={!!busy} onClick={() => submit("APPROVED")}>{busy === "APPROVED" ? "Approving..." : "Approve"}</button>
      <button className="revision-btn" disabled={!!busy} onClick={() => submit("REVISION_REQUESTED")}>{busy === "REVISION_REQUESTED" ? "Sending..." : "Request revision"}</button>
    </div>
  </div>;
}
