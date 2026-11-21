"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type State = { connected: boolean; playing: boolean; open: boolean; speed: number | null; fontSize: number | null; mirror: boolean; progress: number; title: string | null };

const KEY = "24i-teleprompter-remote-code";
const clean = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export function TeleprompterRemote({ initialCode, ar: initialAr }: { initialCode: string; ar: boolean }) {
  const [ar, setAr] = useState(initialAr);
  const t = (en: string, arText: string) => (ar ? arText : en);
  const [code, setCode] = useState(clean(initialCode));
  const [input, setInput] = useState(clean(initialCode));
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (code) return;
    try { const saved = localStorage.getItem(KEY); if (saved) { setCode(saved); setInput(saved); } } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/teleprompter/remote/${code}/command`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t("Code not found.", "الكود مش صحيح.")); setState(null); setCode(""); try { localStorage.removeItem(KEY); } catch { /* ignore */ } return; }
      setState(data); setError("");
      try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
    } catch { /* offline for a moment */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!code) return;
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 1000);
    return () => clearInterval(timer);
  }, [code, refresh]);

  async function send(command: string, value?: number) {
    if (!code) return;
    navigator.vibrate?.(12);
    // Show the change right away; the next refresh confirms it.
    setState((s) => {
      if (!s) return s;
      if (command === "toggle") return { ...s, playing: !s.playing, open: true };
      if (command === "faster" && s.speed) return { ...s, speed: Math.min(300, s.speed + 5) };
      if (command === "slower" && s.speed) return { ...s, speed: Math.max(5, s.speed - 5) };
      if (command === "mirror") return { ...s, mirror: !s.mirror };
      return s;
    });
    try {
      const res = await fetch(`/api/teleprompter/remote/${code}/command`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value ? { command, value } : { command }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); setError(data.error || "Error"); }
    } catch { setError(t("No connection.", "ما في اتصال.")); }
  }

  function connect(e: FormEvent) {
    e.preventDefault();
    const c = clean(input);
    if (c.length !== 6) { setError(t("The code has 6 characters.", "الكود 6 أحرف.")); return; }
    setError(""); setCode(c);
  }

  const btn = (command: string, label: string, aria: string, cls = "") => <button type="button" className={`tpr-btn ${cls}`} aria-label={aria} onClick={() => void send(command)}>{label}</button>;

  return <main className="tpr" dir={ar ? "rtl" : "ltr"}>
    <header className="tpr-head">
      <span className="brand-mark">24i</span>
      <b>{t("Teleprompter remote", "ريموت التيليبرومبتر")}</b>
      <button type="button" className="tpr-lang" onClick={() => setAr(!ar)}>{ar ? "EN" : "ع"}</button>
    </header>

    {!code || !state ? <form className="tpr-pair" onSubmit={connect}>
      <p>{t("Type the code shown on the teleprompter (📱 Phone remote).", "اكتب الكود الظاهر عالتيليبرومبتر (📱 ريموت التلفون).")}</p>
      <input dir="ltr" value={input} onChange={(e) => setInput(clean(e.target.value))} inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="ABC234" maxLength={6} aria-label={t("Code", "الكود")} />
      {error && <div className="tpr-error" role="alert">{error}</div>}
      <button type="submit" className="tpr-btn tpr-primary">{t("Connect", "اتصال")}</button>
    </form> : <>
      <div className={`tpr-status ${state.connected ? "on" : "off"}`}>
        <span>{state.connected ? t("● Connected", "● متصل") : t("○ Teleprompter not responding", "○ التيليبرومبتر مش عم يرد")}</span>
        {state.title && <small dir="auto">{state.title}</small>}
        <div className="tp-progress"><span style={{ width: `${Math.round((state.progress || 0) * 100)}%` }} /></div>
      </div>

      <button type="button" className={`tpr-btn tpr-play ${state.playing ? "playing" : ""}`} onClick={() => void send("toggle")}>
        {state.playing ? `❚❚  ${t("Pause", "إيقاف")}` : `▶  ${state.open ? t("Play", "تشغيل") : t("Start", "ابدأ")}`}
      </button>

      <div className="tpr-grid" dir="ltr">
        {btn("back", "⏪", t("Back", "رجوع"))}
        {btn("restart", "⏮", t("From the start", "من البداية"))}
        {btn("forward", "⏩", t("Forward", "لقدّام"))}
      </div>

      <div className="tpr-row">
        <span>{t("Speed", "السرعة")}</span>
        <div className="tpr-stepper" dir="ltr">
          {btn("slower", "−", t("Slower", "أبطأ"))}
          <b>{state.speed ?? "–"}</b>
          {btn("faster", "+", t("Faster", "أسرع"))}
        </div>
      </div>
      <div className="tpr-row">
        <span>{t("Text size", "حجم الخط")}</span>
        <div className="tpr-stepper" dir="ltr">
          {btn("smaller", "A−", t("Smaller", "أصغر"))}
          <b>{state.fontSize ?? "–"}</b>
          {btn("bigger", "A+", t("Bigger", "أكبر"))}
        </div>
      </div>
      <div className="tpr-row">
        <span>{t("Mirror", "عكس")}</span>
        {btn("mirror", state.mirror ? t("On", "شغّال") : t("Off", "مطفي"), t("Mirror", "عكس"), state.mirror ? "tpr-on" : "")}
      </div>

      {error && <div className="tpr-error" role="alert">{error}</div>}
      <button type="button" className="tpr-link" onClick={() => { setCode(""); setState(null); try { localStorage.removeItem(KEY); } catch { /* ignore */ } }}>{t("Use another code", "كود تاني")}</button>
    </>}
  </main>;
}
