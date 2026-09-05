"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };

export function ProjectManager({ clients }: { clients: ClientOption[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: f.get("clientId"), name: f.get("name"), description: f.get("description") || undefined, status: f.get("status") }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not create project");
      setMessage("Project created."); window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not create project"); }
    finally { setBusy(false); }
  }
  return <section className="panel"><span className="eyebrow">NEW PROJECT</span><h2>Create project</h2>{message && <div className="notice">{message}</div>}<form className="form-grid compact-form" onSubmit={submit}><label>Client<select name="clientId" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label><label>Project name<input name="name" required /></label><label>Status<select name="status" defaultValue="ACTIVE"><option>ACTIVE</option><option>PAUSED</option><option>COMPLETED</option></select></label><label>Description<textarea name="description" rows={3} /></label><button disabled={busy || !clients.length}>Create project</button></form></section>;
}
