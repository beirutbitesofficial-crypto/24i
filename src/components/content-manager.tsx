"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };
type UserOption = { id: string; name: string };

export function ContentManager({ clients, owners }: { clients: ClientOption[]; owners: UserOption[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    const body = {
      clientId: form.get("clientId"),
      title: form.get("title"),
      type: form.get("type"),
      platform: form.getAll("platform"),
      ownerId: form.get("ownerId") || undefined,
    };
    try {
      const res = await fetch("/api/content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not create content");
      setMessage("Content item created.");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not create content"); }
    finally { setBusy(false); }
  }

  return <section className="panel"><div className="section-head"><div><span className="eyebrow">CONTENT PLAN</span><h2>New content item</h2></div></div>{message && <div className="notice">{message}</div>}<form className="form-grid compact-form" onSubmit={submit}>
    <label>Title<input name="title" required /></label>
    <label>Client<select name="clientId" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label>
    <label>Type<select name="type" defaultValue="REEL"><option>REEL</option><option>STATIC_POST</option><option>CAROUSEL</option><option>STORY</option><option>TIKTOK</option><option>YOUTUBE_SHORT</option><option>FACEBOOK_POST</option><option>LINKEDIN_POST</option><option>ADVERTISEMENT</option><option>OTHER</option></select></label>
    <label>Owner<select name="ownerId" defaultValue=""><option value="">Unassigned</option>{owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <fieldset className="client-checks"><legend>Platforms</legend>{["Instagram","Facebook","TikTok","YouTube","LinkedIn"].map((p) => <label className="check" key={p}><input type="checkbox" name="platform" value={p} defaultChecked={p === "Instagram"} />{p}</label>)}</fieldset>
    <button disabled={busy || !clients.length}>{busy ? "Creating…" : "Create content"}</button>
  </form></section>;
}
