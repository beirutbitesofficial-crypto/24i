"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };
type UserOption = { id: string; name: string };

export function ContentManager({ clients, owners, ar = false }: { clients: ClientOption[]; owners: UserOption[]; ar?: boolean }) {
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
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : ar ? "تعذّر إنشاء المحتوى" : "Could not create content");
      setMessage(ar ? "تم إنشاء المحتوى." : "Content item created.");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : ar ? "تعذّر إنشاء المحتوى" : "Could not create content"); }
    finally { setBusy(false); }
  }

  return <section className="panel"><div className="section-head"><div><span className="eyebrow">{ar ? "خطة المحتوى" : "CONTENT PLAN"}</span><h2>{ar ? "إضافة محتوى جديد" : "New content item"}</h2></div></div>{message && <div className="notice">{message}</div>}<form className="form-grid compact-form" onSubmit={submit}>
    <label>{ar ? "العنوان" : "Title"}<input name="title" required /></label>
    <label>{ar ? "العميل" : "Client"}<select name="clientId" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label>
    <label>{ar ? "النوع" : "Type"}<select name="type" defaultValue="REEL"><option value="REEL">Reel</option><option value="STATIC_POST">Post</option><option value="CAROUSEL">Carousel</option><option value="STORY">Story</option><option value="TIKTOK">TikTok</option><option value="YOUTUBE_SHORT">YouTube Short</option><option value="FACEBOOK_POST">Facebook Post</option><option value="LINKEDIN_POST">LinkedIn Post</option><option value="ADVERTISEMENT">Ad</option><option value="OTHER">{ar ? "غير ذلك" : "Other"}</option></select></label>
    <label>{ar ? "المسؤول" : "Owner"}<select name="ownerId" defaultValue=""><option value="">{ar ? "غير محدد" : "Unassigned"}</option>{owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <fieldset className="client-checks"><legend>{ar ? "المنصات" : "Platforms"}</legend>{["Instagram","Facebook","TikTok","YouTube","LinkedIn"].map((p) => <label className="check" key={p}><input type="checkbox" name="platform" value={p} defaultChecked={p === "Instagram"} />{p}</label>)}</fieldset>
    <button disabled={busy || !clients.length}>{busy ? (ar ? "جارٍ الإنشاء…" : "Creating…") : (ar ? "إنشاء المحتوى" : "Create content")}</button>
  </form></section>;
}
