"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";

type Message = { id: string; body: string; toRole: string | null; createdAt: string; author: { id: string; name: string; role: string; roleName: string } };

const ROLES = [
  { value: "MANAGER", en: "Manager", ar: "المدير" },
  { value: "SOCIAL_MEDIA_MANAGER", en: "Social media", ar: "السوشيال ميديا" },
  { value: "EDITOR", en: "Editor", ar: "المونتير" },
];

const POLL_MS = 8000;

export function ChatThread({ clientId, title, meId, isClient = false, ar = false, backHref }: { clientId: string; title: string; meId: string; isClient?: boolean; ar?: boolean; backHref?: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState("");
  const [toRole, setToRole] = useState("MANAGER");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${clientId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load messages");
      setMessages(data.messages);
      window.dispatchEvent(new Event("chat:read"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages");
    }
  }, [clientId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const newest = messages?.at(-1)?.id;
    if (newest && newest !== lastId.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    lastId.current = newest;
  }, [messages]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setError("");
    try {
      const res = await fetch(`/api/chat/${clientId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, toRole: isClient ? toRole : undefined }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Message not sent");
      setText("");
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message not sent");
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
      e.preventDefault();
      void send();
    }
  }

  const roleLabel = (key: string | null) => { const r = ROLES.find((x) => x.value === key); return r ? (ar ? r.ar : r.en) : ""; };
  const time = (iso: string) => new Date(iso).toLocaleString(ar ? "ar" : "en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return <section className="panel chat-thread">
    <header className="chat-head">
      {backHref && <a className="chat-back mobile-only" href={backHref} aria-label={ar ? "رجوع" : "Back"}>‹</a>}
      <span className="chat-avatar"><Icon name="chat" size={16} /></span>
      <div><b>{title}</b><small>{isClient ? (ar ? "راسل الفريق مباشرة. يصلهم إشعار فوراً." : "Message the team directly. They get notified right away.") : (ar ? "محادثة العميل" : "Client conversation")}</small></div>
    </header>

    <div className="chat-messages" ref={scroller} aria-live="polite">
      {messages === null && <p className="muted chat-empty">{ar ? "جار التحميل…" : "Loading…"}</p>}
      {messages?.length === 0 && <p className="muted chat-empty">{isClient ? (ar ? "اكتب رسالتك الأولى. اختر لمن تريد إرسالها." : "Send your first message. Pick who it is for below.") : (ar ? "لا رسائل بعد." : "No messages yet.")}</p>}
      {messages?.map((m) => {
        const mine = m.author.id === meId;
        const fromClient = m.author.role === "CLIENT";
        return <div key={m.id} className={`bubble-row${mine ? " mine" : ""}`}>
          <div className="bubble">
            {!mine && <span className="bubble-author">{m.author.name}{!fromClient && ` · ${m.author.roleName}`}</span>}
            {fromClient && m.toRole && <span className="bubble-to">{ar ? "إلى" : "To"}: {roleLabel(m.toRole)}</span>}
            <p>{m.body}</p>
            <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
          </div>
        </div>;
      })}
    </div>

    <form className="chat-compose" onSubmit={send}>
      {isClient && <div className="chat-to" role="radiogroup" aria-label={ar ? "إلى" : "Send to"}>
        <span>{ar ? "إلى:" : "To:"}</span>
        {ROLES.map((r) => <button type="button" key={r.value} role="radio" aria-checked={toRole === r.value} className={toRole === r.value ? "active" : ""} onClick={() => setToRole(r.value)}>{ar ? r.ar : r.en}</button>)}
      </div>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="chat-input">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} rows={1} maxLength={4000} placeholder={ar ? "اكتب رسالة…" : "Write a message…"} aria-label={ar ? "الرسالة" : "Message"} />
        <button type="submit" disabled={sending || !text.trim()} aria-label={ar ? "إرسال" : "Send"}><Icon name="send" size={18} /></button>
      </div>
    </form>
  </section>;
}
