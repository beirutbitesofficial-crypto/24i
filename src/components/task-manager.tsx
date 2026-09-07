"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };
type UserOption = { id: string; name: string; role: string };

export function TaskManager({ clients, users, ar = false }: { clients: ClientOption[]; users: UserOption[]; ar?: boolean }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    const due = form.get("dueAt");
    const body = {
      clientId: form.get("clientId") || undefined,
      title: form.get("title"),
      description: form.get("description") || undefined,
      category: form.get("category"),
      priority: form.get("priority"),
      dueAt: due ? new Date(String(due)).toISOString() : undefined,
      assigneeIds: form.getAll("assigneeIds"),
    };
    try {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : ar ? "تعذّر إنشاء المهمة" : "Could not create task");
      setMessage(ar ? "تم إنشاء المهمة وإرسال إشعار للمكلّفين." : "Task created and assignees notified.");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : ar ? "تعذّر إنشاء المهمة" : "Could not create task"); }
    finally { setBusy(false); }
  }

  return <section className="panel"><div className="section-head"><div><span className="eyebrow">{ar ? "تعيين" : "ASSIGN"}</span><h2>{ar ? "مهمة جديدة" : "New task"}</h2></div></div>{message && <div className="notice">{message}</div>}<form className="form-grid compact-form" onSubmit={submit}>
    <label>{ar ? "عنوان المهمة" : "Task title"}<input name="title" required /></label>
    <label>{ar ? "الفئة" : "Category"}<input name="category" placeholder={ar ? "مونتاج، تصميم، تصوير…" : "Editing, Design, Shooting…"} required /></label>
    <label>{ar ? "العميل" : "Client"}<select name="clientId" defaultValue=""><option value="">{ar ? "داخلي / بدون عميل" : "Internal / no client"}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label>
    <label>{ar ? "الأولوية" : "Priority"}<select name="priority" defaultValue="MEDIUM"><option value="LOW">{ar ? "منخفضة" : "Low"}</option><option value="MEDIUM">{ar ? "متوسطة" : "Medium"}</option><option value="HIGH">{ar ? "عالية" : "High"}</option><option value="URGENT">{ar ? "عاجلة" : "Urgent"}</option></select></label>
    <label>{ar ? "الموعد النهائي" : "Due date & time"}<input name="dueAt" type="datetime-local" /></label>
    <label>{ar ? "الوصف" : "Description"}<textarea name="description" rows={3} /></label>
    <fieldset className="client-checks"><legend>{ar ? "المكلّفون" : "Assignees"}</legend>{users.map((u) => <label className="check" key={u.id}><input type="checkbox" name="assigneeIds" value={u.id} />{u.name} · {u.role}</label>)}</fieldset>
    <button disabled={busy}>{busy ? (ar ? "جارٍ الإنشاء…" : "Creating…") : (ar ? "إنشاء المهمة" : "Create task")}</button>
  </form></section>;
}
