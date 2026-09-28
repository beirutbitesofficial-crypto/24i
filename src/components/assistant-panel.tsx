"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { fastStart } from "@/lib/faststart";
import { putFileWithProgress } from "@/components/file-uploader";

type Msg = { role: "user" | "assistant"; content: string; display?: string; link?: string; tone?: "done" | "error" };
type Pending = { tool: string; args: Record<string, unknown>; summary: string };
type Attachment = { fileId: string; name: string; clientId: string; brandName: string };
type ClientOption = { id: string; brandName: string };

const STORE = (userId: string) => `assistant:${userId}`;

export function AssistantPanel({ userId, ar, canUpload }: { userId: string; ar: boolean; canUpload: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [clients, setClients] = useState<ClientOption[] | null>(null);
  const [uploadClient, setUploadClient] = useState("");
  const [upload, setUpload] = useState<{ name: string; progress: number } | null>(null);
  const [pickFor, setPickFor] = useState<File | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { const saved = sessionStorage.getItem(STORE(userId)); if (saved) setMessages(JSON.parse(saved)); } catch { /* ignore */ }
  }, [userId]);
  useEffect(() => {
    try { sessionStorage.setItem(STORE(userId), JSON.stringify(messages.slice(-40))); } catch { /* ignore */ }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, userId]);
  useEffect(() => {
    if (!open || clients || !canUpload) return;
    fetch("/api/assistant").then((r) => r.json()).then((d) => { setClients(d.clients || []); setUploadClient(d.clients?.[0]?.id || ""); }).catch(() => setClients([]));
  }, [open, clients, canUpload]);

  const t = (en: string, arText: string) => (ar ? arText : en);

  async function ask(history: Msg[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("The assistant could not answer.", "المساعد ما قدر يجاوب."));
      const next = [...history];
      if (data.reply) next.push({ role: "assistant", content: data.reply });
      setMessages(next);
      setPending(data.pending || null);
    } catch (err) {
      setMessages([...history, { role: "assistant", content: err instanceof Error ? err.message : "Error", tone: "error" }]);
    } finally {
      setBusy(false);
    }
  }

  function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !attachments.length) || busy || upload) return;
    const files = attachments.map((a) => `[Attached file "${a.name}" — fileId: ${a.fileId}, client: ${a.brandName} (clientId: ${a.clientId})]`).join("\n");
    const content = [files, body].filter(Boolean).join("\n");
    const display = [...attachments.map((a) => `📎 ${a.name} · ${a.brandName}`), body].filter(Boolean).join("\n");
    const history: Msg[] = [...messages, { role: "user", content, display }];
    setMessages(history); setText(""); setAttachments([]); setPending(null);
    void ask(history);
  }

  async function confirm() {
    if (!pending) return;
    const action = pending;
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: { tool: action.tool, args: action.args } }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The action failed");
      setMessages((m) => [...m, { role: "assistant", content: `✅ ${data.message} (${action.summary.split("\n")[0]})`, link: data.link, tone: "done" }]);
      setPending(null);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : "The action failed"}`, tone: "error" }]);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setMessages((m) => [...m, { role: "assistant", content: t("Cancelled — nothing was done.", "تم الإلغاء، ما صار شي.") }]);
    setPending(null);
  }

  async function uploadFile(picked: File, clientId: string) {
    const client = clients?.find((c) => c.id === clientId);
    if (!client) return;
    setPickFor(null);
    setUpload({ name: picked.name, progress: 0 });
    try {
      const file = await fastStart(picked);
      const mimeType = file.type || "application/octet-stream";
      const sign = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, name: file.name, type: mimeType, size: file.size }) });
      const signed = await sign.json().catch(() => ({}));
      if (!sign.ok) throw new Error(signed.error || "Could not prepare upload");
      await putFileWithProgress(signed.url, file, mimeType, (progress) => setUpload({ name: picked.name, progress }));
      const complete = await fetch("/api/uploads/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, key: signed.key, originalName: file.name, mimeType, size: String(file.size) }) });
      const done = await complete.json().catch(() => ({}));
      if (!complete.ok) throw new Error(done.error || "Could not register file");
      setAttachments((a) => [...a, { fileId: done.id, name: picked.name, clientId, brandName: client.brandName }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${err instanceof Error ? err.message : "Upload failed"}`, tone: "error" }]);
    } finally {
      setUpload(null);
    }
  }

  function picked(file?: File) {
    if (!file) return;
    if (clients && clients.length === 1) void uploadFile(file, clients[0].id);
    else setPickFor(file);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) { e.preventDefault(); send(); }
  }

  const starters = canUpload
    ? [t("What do I have to do today?", "شو عندي شغل اليوم؟"), t("Which content is waiting for the client?", "شو في محتوى ناطر موافقة العميل؟"), t("Write a caption for a new reel", "اكتبلي كابشن لريل جديد")]
    : [t("What is waiting for my approval?", "شو ناطر موافقتي؟"), t("Help me write a script idea", "ساعدني بفكرة سكربت"), t("Send a message to my social media manager", "ابعت رسالة للسوشيال ميديا")];

  return <>
    {!open && <button type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-label={t("AI assistant", "المساعد الذكي")} title={t("AI assistant", "المساعد الذكي")}>✨</button>}
    {open && <section className="assistant-panel" role="dialog" aria-label={t("AI assistant", "المساعد الذكي")} dir={ar ? "rtl" : "ltr"}>
      <header className="assistant-head">
        <span className="assistant-badge">✨</span>
        <div><b>{t("AI assistant", "المساعد الذكي")}</b><small>{t("Asks before doing anything", "بيسألك قبل ما يعمل أي شي")}</small></div>
        <button type="button" className="assistant-icon" onClick={() => { setMessages([]); setPending(null); setAttachments([]); }} title={t("New conversation", "محادثة جديدة")}>↺</button>
        <button type="button" className="assistant-icon" onClick={() => setOpen(false)} aria-label={t("Close", "إغلاق")}>✕</button>
      </header>

      <div className="assistant-messages" ref={scroller}>
        {!messages.length && <div className="assistant-empty">
          <p>{t("Hi! Ask me anything about your work, or tell me what to do.", "أهلا! اسألني عن شغلك أو قلي شو بدك أعمل.")}</p>
          {canUpload && <p className="muted">{t("Tip: attach a video with 📎 and say “send it to <client>”.", "جرّب: ارفع فيديو بـ 📎 وقلي «ابعتو لـ <اسم العميل>».")}</p>}
          <div className="assistant-starters">{starters.map((s) => <button type="button" key={s} onClick={() => setText(s)}>{s}</button>)}</div>
        </div>}
        {messages.map((m, i) => <div key={i} className={`assistant-msg ${m.role}${m.tone ? ` ${m.tone}` : ""}`}>
          <p dir="auto">{m.display ?? m.content}</p>
          {m.link && <a href={m.link}>{t("Open", "فتح")} →</a>}
        </div>)}
        {busy && !pending && <div className="assistant-msg assistant typing"><span /><span /><span /></div>}
        {pending && <div className="assistant-confirm">
          <span className="eyebrow">{t("Confirm action", "تأكيد")}</span>
          <p dir="auto">{pending.summary}</p>
          <div className="assistant-confirm-actions">
            <button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "…" : t("Confirm", "أكّد")}</button>
            <button type="button" className="secondary" disabled={busy} onClick={cancel}>{t("Cancel", "إلغاء")}</button>
          </div>
        </div>}
      </div>

      {pickFor && clients && <div className="assistant-pick">
        <span>{t(`Which client is “${pickFor.name}” for?`, `لأي عميل «${pickFor.name}»؟`)}</span>
        <div className="assistant-pick-row">
          <select value={uploadClient} onChange={(e) => setUploadClient(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}</select>
          <button type="button" onClick={() => void uploadFile(pickFor, uploadClient)}>{t("Upload", "ارفع")}</button>
          <button type="button" className="secondary" onClick={() => setPickFor(null)}>✕</button>
        </div>
      </div>}
      {(attachments.length > 0 || upload) && <div className="assistant-attachments">
        {attachments.map((a) => <span key={a.fileId} className="assistant-chip">📎 {a.name} · {a.brandName}<button type="button" onClick={() => setAttachments((x) => x.filter((y) => y.fileId !== a.fileId))} aria-label="Remove">✕</button></span>)}
        {upload && <span className="assistant-chip">⏳ {upload.name} · {upload.progress}%</span>}
      </div>}

      <form className="assistant-input" onSubmit={send}>
        {canUpload && <>
          <input ref={fileInput} type="file" hidden accept="video/*,image/*,audio/*,application/pdf" onChange={(e) => { picked(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className="assistant-icon" disabled={!!upload || !clients?.length} onClick={() => fileInput.current?.click()} title={t("Attach a file", "إرفاق ملف")}>📎</button>
        </>}
        <textarea dir="auto" rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} maxLength={4000} placeholder={t("Ask or tell me what to do…", "اسأل أو قلي شو بدك…")} />
        <button type="submit" disabled={busy || !!upload || (!text.trim() && !attachments.length)} aria-label={t("Send", "إرسال")}>➤</button>
      </form>
    </section>}
  </>;
}
