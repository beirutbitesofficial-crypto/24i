"use client";

import { FormEvent, useState } from "react";

export function TaskStatus({ taskId, current, ar = false }: { taskId: string; current: string; ar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: form.get("status"), note: form.get("note") || undefined }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : ar ? "تعذّر تحديث المهمة" : "Could not update task");
      setMessage(ar ? "تم الحفظ" : "Saved"); window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : ar ? "تعذّر تحديث المهمة" : "Could not update task"); }
    finally { setBusy(false); }
  }
  return <form className="inline-action" onSubmit={submit}><select name="status" defaultValue={current}><option value="TODO">{ar ? "جديدة" : "To do"}</option><option value="IN_PROGRESS">{ar ? "قيد التنفيذ" : "In progress"}</option><option value="REVIEW">{ar ? "مراجعة" : "Review"}</option><option value="REVISION">{ar ? "تعديل" : "Revision"}</option><option value="WAITING_CLIENT">{ar ? "بانتظار العميل" : "Waiting client"}</option><option value="COMPLETED">{ar ? "مكتملة" : "Completed"}</option></select><input name="note" placeholder={ar ? "ملاحظة / تعديل" : "Note / revision"} /><button disabled={busy}>{ar ? "حفظ" : "Save"}</button>{message && <small>{message}</small>}</form>;
}
