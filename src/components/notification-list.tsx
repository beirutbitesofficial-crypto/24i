"use client";

import { useState } from "react";
import { Badge, Empty } from "@/components/ui";

type Item = { id: string; title: string; body: string; deepLink: string; kind: string; createdAt: string; readAt: string | null };

export function NotificationList({ items }: { items: Item[] }) {
  const [busy, setBusy] = useState("");
  async function mark(id: string) {
    setBusy(id);
    try { await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }); window.location.reload(); }
    finally { setBusy(""); }
  }
  if (!items.length) return <section className="panel"><Empty title="No notifications yet" hint="You’ll be notified about approvals, tasks and payments." /></section>;
  return <section className="panel flush">
    {items.map((n) => <article className={`notification-row ${n.readAt ? "read" : "unread"}`} key={n.id}>
      <div>
        <small><Badge value={n.kind} /> · {new Date(n.createdAt).toLocaleString()}</small>
        <h3>{n.title}</h3>
        <p>{n.body}</p>
        <a href={n.deepLink}>Open →</a>
      </div>
      {!n.readAt && <button className="secondary small-button" disabled={busy === n.id} onClick={() => void mark(n.id)}>Mark as read</button>}
    </article>)}
  </section>;
}
