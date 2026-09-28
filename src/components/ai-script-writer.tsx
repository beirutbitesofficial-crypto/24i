"use client";

import { useState } from "react";

type ClientOption = { id: string; brandName: string };

async function call(body: unknown) {
  const res = await fetch("/api/ai/script", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "The AI could not write the script.");
  return data as { title: string; body: string };
}

export function AiScriptWriter({ clients, ar, onUse, onCopy }: { clients: ClientOption[]; ar: boolean; onUse?: (script: { clientId: string; title: string; body: string }) => void; onCopy: (text: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState("REEL");
  const [seconds, setSeconds] = useState("30");
  const [language, setLanguage] = useState("LEBANESE");
  const [tone, setTone] = useState("");
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function run(mode: "write" | "improve") {
    setBusy(true); setError("");
    try {
      const script = await call({ clientId, mode, idea: mode === "write" ? idea : feedback, format, seconds, language, tone: tone || undefined, current: mode === "improve" ? result?.body : undefined });
      setResult({ title: script.title || result?.title || "", body: script.body });
      setFeedback("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI could not write the script.");
    } finally {
      setBusy(false);
    }
  }

  if (!clients.length) return null;
  if (!open) return <button type="button" className="ai-open" onClick={() => setOpen(true)}>✨ {ar ? "اكتب سكربت بالذكاء الاصطناعي" : "Write a script with AI"}</button>;

  return <section className="panel ai-writer">
    <div className="section-head">
      <div><span className="eyebrow">✨ AI</span><h2>{ar ? "كاتب السكربتات" : "AI script writer"}</h2></div>
      <button type="button" className="secondary small-button" onClick={() => setOpen(false)}>{ar ? "إغلاق" : "Close"}</button>
    </div>
    <div className="form-grid compact-form">
      {clients.length > 1 && <label>{ar ? "العميل" : "Client"}<select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label>}
      <label>{ar ? "النوع" : "Format"}<select value={format} onChange={(e) => setFormat(e.target.value)}>
        <option value="REEL">Reel / TikTok</option><option value="POST">{ar ? "فيديو بوست" : "Video post"}</option><option value="STORY">{ar ? "ستوري" : "Stories"}</option>
      </select></label>
      {format === "REEL" && <label>{ar ? "المدة" : "Length"}<select value={seconds} onChange={(e) => setSeconds(e.target.value)}>
        {["15", "30", "45", "60", "90"].map((s) => <option key={s} value={s}>{s} {ar ? "ثانية" : "seconds"}</option>)}
      </select></label>}
      <label>{ar ? "اللغة" : "Language"}<select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="LEBANESE">{ar ? "لبناني (عربي)" : "Lebanese (Arabic letters)"}</option>
        <option value="ARABIZI">{ar ? "لبناني (Arabizi)" : "Lebanese (Arabizi)"}</option>
        <option value="MIXED">{ar ? "عربي + إنكليزي" : "Arabic + English mix"}</option>
        <option value="ENGLISH">English</option>
      </select></label>
      <label>{ar ? "الأسلوب (اختياري)" : "Tone (optional)"}<input value={tone} onChange={(e) => setTone(e.target.value)} placeholder={ar ? "مضحك، فخم، عفوي…" : "Funny, luxury, casual…"} /></label>
      <label className="full-field">{ar ? "الفكرة" : "Idea / brief"}<textarea dir="auto" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={ar ? "مثلاً: عرض الغدا الجديد، 3 أطباق بـ 15$، بدنا نشجع الناس يجو وقت الظهر" : "e.g. New lunch offer: 3 dishes for $15, we want people to come at noon"} /></label>
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="review-actions"><button type="button" disabled={busy || idea.trim().length < 3} onClick={() => void run("write")}>{busy && !result ? (ar ? "عم يكتب…" : "Writing…") : result ? (ar ? "اكتب واحد جديد" : "Write a new one") : (ar ? "✨ اكتب السكربت" : "✨ Write the script")}</button></div>

    {result && <div className="ai-result">
      <label>{ar ? "العنوان" : "Title"}<input dir="auto" value={result.title} onChange={(e) => setResult({ ...result, title: e.target.value })} /></label>
      <label>{ar ? "السكربت" : "Script"}<textarea dir="auto" rows={12} value={result.body} onChange={(e) => setResult({ ...result, body: e.target.value })} /></label>
      <div className="ai-refine">
        <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={ar ? "بدك تغيّر شي؟ مثلاً: قصّرو، زيد نكتة، غيّر النهاية" : "Want changes? e.g. make it shorter, add a joke, change the ending"} />
        <button type="button" className="secondary" disabled={busy} onClick={() => void run("improve")}>{busy ? (ar ? "عم يعدّل…" : "Updating…") : (ar ? "عدّل" : "Update")}</button>
      </div>
      <div className="review-actions">
        <button type="button" className="secondary" onClick={async () => { setCopied(await onCopy(result.body)); setTimeout(() => setCopied(false), 2000); }}>{copied ? (ar ? "✓ تم النسخ" : "✓ Copied") : (ar ? "نسخ" : "Copy")}</button>
        {onUse && <button type="button" onClick={() => onUse({ clientId, ...result })}>{ar ? "استعمله كسكربت جديد" : "Use as a new script"}</button>}
      </div>
    </div>}
  </section>;
}
