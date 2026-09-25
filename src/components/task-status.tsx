"use client";

import { FormEvent, useState } from "react";


export function TaskStatus({ taskId, current }: { taskId: string; current: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: form.get("status"), note: form.get("note") || undefined }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update task");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not update task"); }
    finally { setBusy(false); }
  }
  return <form className="inline-action" onSubmit={submit}><select name="status" defaultValue={current}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="REVIEW">Review</option><option value="REVISION">Revision</option><option value="WAITING_CLIENT">Waiting on client</option><option value="COMPLETED">Completed</option></select><input name="note" placeholder="Add a note (optional)" /><button disabled={busy}>Save</button>{message && <small>{message}</small>}</form>;
}
