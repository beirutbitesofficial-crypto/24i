"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { layoutText, type Direction, type Paragraph } from "@/lib/bidi-text";

type ScriptOption = { id: string; title: string; client: string; body: string };
type Align = "start" | "center" | "end";
type FontChoice = "plex" | "naskh" | "notosans" | "system";

type Settings = {
  fontSize: number;
  lineHeight: number;
  wordSpacing: number;
  letterSpacing: number;
  align: Align;
  direction: Direction | "auto";
  font: FontChoice;
  speed: number;
  margin: number;
  mirrorX: boolean;
  mirrorY: boolean;
  guide: boolean;
  countdown: number;
};

const DEFAULTS: Settings = {
  fontSize: 56, lineHeight: 1.7, wordSpacing: 0, letterSpacing: 0, align: "start", direction: "auto",
  font: "plex", speed: 40, margin: 8, mirrorX: false, mirrorY: false, guide: true, countdown: 3,
};

const SETTINGS_KEY = "24i-teleprompter-settings";
const DRAFT_KEY = "24i-teleprompter-draft";

// Latin font first, Arabic second: Latin glyphs come from the Latin font and every Arabic
// character falls through to the Arabic font, which does the shaping and tashkeel.
const FONT_STACKS: Record<FontChoice, string> = {
  plex: "var(--font-latin), var(--font-arabic), system-ui, sans-serif",
  naskh: "var(--font-latin), var(--font-naskh), var(--font-arabic), serif",
  notosans: "var(--font-latin), var(--font-noto-arabic), var(--font-arabic), sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', 'Geeza Pro', 'Noto Sans Arabic', Tahoma, sans-serif",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch { /* storage unavailable */ }
}

// Short embedded phrases ("5:30 PM", "iPhone 15") are kept on one line so a wrap never
// splits them, which would scramble their reading order across two lines.
const keepTogether = (text: string) => text.length <= 24 && text.trim().split(/\s+/).length <= 3;

// Renders text for reading. Each paragraph gets its own base direction (dir="auto" =
// first strong character, as UAX #9 P2/P3; or the manual override), and each run in the
// other direction is wrapped in <bdi>, a directional isolate. The characters are rendered
// exactly as typed: the browser's bidi algorithm orders them and its shaper joins Arabic.
export function BidiText({ paragraphs, auto, className, style }: { paragraphs: Paragraph[]; auto: boolean; className?: string; style?: CSSProperties }) {
  return <div className={className} style={style}>
    {paragraphs.map((p, i) => <p key={i} dir={auto ? "auto" : p.dir} className={`tp-para${auto ? " tp-plaintext" : ""}`}>
      {p.text === "" ? <br /> : p.runs.map((r, j) => r.isolate
        ? <bdi key={j} dir={r.dir} className={`tp-run tp-${r.script}${keepTogether(r.text) ? " tp-keep" : ""}`}>{r.text}</bdi>
        : <span key={j} className={`tp-run tp-${r.script}`}>{r.text}</span>)}
    </p>)}
  </div>;
}

export function Teleprompter({ scripts, initialScriptId, fontClassName, ar }: { scripts: ScriptOption[]; initialScriptId?: string; fontClassName: string; ar: boolean }) {
  const t = (en: string, arText: string) => (ar ? arText : en);
  const initial = scripts.find((s) => s.id === initialScriptId);
  const [text, setText] = useState(initial?.body ?? "");
  const [scriptId, setScriptId] = useState(initial?.id ?? "");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [stage, setStage] = useState(false);
  const [count, setCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const lastFrame = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Restore saved settings and, when no script was chosen, the last draft.
  useEffect(() => {
    setSettings(load(SETTINGS_KEY, DEFAULTS));
    if (!initial) {
      try { const draft = localStorage.getItem(DRAFT_KEY); if (draft) setText(draft); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { save(SETTINGS_KEY, settings); }, [settings]);
  useEffect(() => { if (!scriptId) save(DRAFT_KEY, text); }, [text, scriptId]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 2500); return () => clearTimeout(timer); }, [notice]);

  const paragraphs = useMemo(() => layoutText(text, settings.direction, ar ? "rtl" : "ltr"), [text, settings.direction, ar]);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  const textStyle: CSSProperties = {
    fontFamily: FONT_STACKS[settings.font],
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    wordSpacing: `${settings.wordSpacing}em`,
    textAlign: settings.align,
    ["--tp-letter" as string]: `${settings.letterSpacing}em`,
  };

  const applyOffset = useCallback(() => {
    const content = contentRef.current;
    const view = viewportRef.current;
    if (!content || !view) return;
    const max = Math.max(0, content.scrollHeight - view.clientHeight * 0.35);
    offset.current = Math.min(Math.max(0, offset.current), max);
    content.style.transform = `translate3d(0, ${-offset.current}px, 0)`;
    setProgress(max ? offset.current / max : 0);
    return max;
  }, []);

  // Scrolling loop: pixels per second, independent of frame rate.
  useEffect(() => {
    if (!playing) { lastFrame.current = null; return; }
    let raf = 0;
    const step = (now: number) => {
      if (lastFrame.current !== null) {
        offset.current += (settingsRef.current.speed * (now - lastFrame.current)) / 1000;
        const max = applyOffset();
        if (max !== undefined && offset.current >= max) { setPlaying(false); return; }
      }
      lastFrame.current = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, applyOffset]);

  // Keep the screen awake while the prompter is open.
  useEffect(() => {
    if (!stage) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((lock) => { wakeLock.current = lock; }).catch(() => {});
    return () => { wakeLock.current?.release().catch(() => {}); wakeLock.current = null; };
  }, [stage]);

  // Countdown before scrolling starts.
  useEffect(() => {
    if (count <= 0) return;
    const timer = setTimeout(() => { if (count === 1) setPlaying(true); setCount(count - 1); }, 1000);
    return () => clearTimeout(timer);
  }, [count]);

  function startStage() {
    if (!text.trim()) { setNotice(t("Write or choose a script first.", "اكتب أو اختار سكربت أولاً.")); return; }
    offset.current = 0;
    setStage(true);
  }
  // Once the stage is on screen: position the text and go full screen where supported.
  useEffect(() => {
    if (!stage) return;
    applyOffset();
    stageRef.current?.requestFullscreen?.().catch(() => {});
    const onExit = () => { if (!document.fullscreenElement) setPlaying(false); };
    document.addEventListener("fullscreenchange", onExit);
    return () => document.removeEventListener("fullscreenchange", onExit);
  }, [stage, applyOffset]);
  function closeStage() {
    setPlaying(false); setCount(0); setStage(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  const toggle = useCallback(() => {
    if (count > 0) { setCount(0); return; }
    if (playing) setPlaying(false);
    else if (settingsRef.current.countdown > 0 && offset.current === 0) setCount(settingsRef.current.countdown);
    else setPlaying(true);
  }, [playing, count]);
  const nudge = useCallback((px: number) => { offset.current += px; applyOffset(); }, [applyOffset]);

  // Keyboard and Bluetooth page-turner remotes (they send arrows / Page Up / Page Down).
  useEffect(() => {
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => {
      const line = settingsRef.current.fontSize * settingsRef.current.lineHeight;
      switch (e.key) {
        case " ": case "Enter": case "k": e.preventDefault(); toggle(); break;
        case "ArrowUp": e.preventDefault(); setSettings((s) => ({ ...s, speed: Math.min(300, s.speed + 5) })); break;
        case "ArrowDown": e.preventDefault(); setSettings((s) => ({ ...s, speed: Math.max(5, s.speed - 5) })); break;
        case "PageDown": case "ArrowRight": e.preventDefault(); nudge(line * 2); break;
        case "PageUp": case "ArrowLeft": e.preventDefault(); nudge(-line * 2); break;
        case "+": case "=": setSettings((s) => ({ ...s, fontSize: Math.min(160, s.fontSize + 4) })); break;
        case "-": case "_": setSettings((s) => ({ ...s, fontSize: Math.max(20, s.fontSize - 4) })); break;
        case "m": case "M": setSettings((s) => ({ ...s, mirrorX: !s.mirrorX })); break;
        case "Home": case "r": case "R": offset.current = 0; applyOffset(); break;
        case "Escape": closeStage(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
     
  }, [stage, toggle, nudge, applyOffset]);

  // Re-clamp when the text or size changes while the prompter is open.
  useEffect(() => { if (stage) applyOffset(); }, [stage, settings.fontSize, settings.lineHeight, settings.margin, text, applyOffset]);

  // Drag (touch) and wheel move the text by hand.
  const drag = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { drag.current = e.clientY; };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current === null) return;
    const dy = (e.clientY - drag.current) * (settings.mirrorY ? -1 : 1);
    drag.current = e.clientY;
    nudge(-dy);
  };
  const onPointerUp = () => { drag.current = null; };

  async function copy() {
    try { await navigator.clipboard.writeText(text); setNotice(t("Copied.", "تم النسخ.")); }
    catch { setNotice(t("Copy failed.", "تعذّر النسخ.")); }
  }
  function download() {
    // UTF-8, byte for byte what is in the editor.
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(scripts.find((s) => s.id === scriptId)?.title || "script").replace(/[\\/:*?"<>|]+/g, " ").trim() || "script"}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function openFile(file?: File) {
    if (!file) return;
    file.text().then((content) => { setText(content); setScriptId(""); }).catch(() => setNotice(t("Could not read the file.", "تعذّرت قراءة الملف.")));
  }

  const mirror = `scale(${settings.mirrorX ? -1 : 1}, ${settings.mirrorY ? -1 : 1})`;
  const auto = settings.direction === "auto";

  return <div className={`tp ${fontClassName}`}>
    {notice && <div className="notice" role="status">{notice}</div>}

    <div className="tp-layout">
      <section className="panel tp-editor">
        <div className="tp-toolbar">
          {scripts.length > 0 && <select aria-label={t("Script", "السكربت")} value={scriptId} onChange={(e) => { const s = scripts.find((x) => x.id === e.target.value); setScriptId(e.target.value); if (s) setText(s.body); }}>
            <option value="">{t("Your own text", "نص خاص")}</option>
            {scripts.map((s) => <option key={s.id} value={s.id}>{s.client} · {s.title}</option>)}
          </select>}
          <label className="tp-file secondary">{t("Open .txt", "فتح ملف")}<input type="file" accept=".txt,text/plain" hidden onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
          <button type="button" className="secondary" onClick={() => void copy()}>{t("Copy", "نسخ")}</button>
          <button type="button" className="secondary" onClick={download}>{t("Download", "تنزيل")}</button>
        </div>
        <textarea
          className="tp-input"
          dir="auto"
          spellCheck={false}
          value={text}
          onChange={(e) => { setText(e.target.value); if (scriptId) setScriptId(""); }}
          placeholder={t("Paste or write your script… Arabic, English or both.", "الصق أو اكتب السكربت… عربي، إنكليزي أو الاثنين.")}
          style={{ fontFamily: FONT_STACKS[settings.font] }}
        />
        <button type="button" className="tp-start" onClick={startStage}>▶ {t("Start teleprompter", "ابدأ التيليبرومبتر")}</button>
      </section>

      <section className="panel tp-settings">
        <h2>{t("Display", "العرض")}</h2>
        <label>{t("Font", "الخط")}<select value={settings.font} onChange={(e) => set("font", e.target.value as FontChoice)}>
          <option value="plex">IBM Plex Arabic + Inter</option>
          <option value="naskh">Noto Naskh Arabic + Inter</option>
          <option value="notosans">Noto Sans Arabic + Inter</option>
          <option value="system">{t("Device font", "خط الجهاز")}</option>
        </select></label>
        <Range label={t("Font size", "حجم الخط")} value={settings.fontSize} min={20} max={160} step={2} unit="px" onChange={(v) => set("fontSize", v)} />
        <Range label={t("Line spacing", "المسافة بين الأسطر")} value={settings.lineHeight} min={1.1} max={2.6} step={0.05} onChange={(v) => set("lineHeight", v)} />
        <Range label={t("Word spacing", "المسافة بين الكلمات")} value={settings.wordSpacing} min={0} max={1} step={0.05} unit="em" onChange={(v) => set("wordSpacing", v)} />
        <Range label={t("Letter spacing (English only)", "تباعد الأحرف (إنكليزي فقط)")} value={settings.letterSpacing} min={0} max={0.3} step={0.01} unit="em" onChange={(v) => set("letterSpacing", v)} />
        <Range label={t("Side margins", "الهوامش")} value={settings.margin} min={0} max={30} step={1} unit="%" onChange={(v) => set("margin", v)} />
        <Range label={t("Speed", "السرعة")} value={settings.speed} min={5} max={300} step={5} unit="px/s" onChange={(v) => set("speed", v)} />
        <div className="tp-segment" role="group" aria-label={t("Alignment", "المحاذاة")}>
          {(["start", "center", "end"] as Align[]).map((a) => <button key={a} type="button" className={settings.align === a ? "active" : ""} onClick={() => set("align", a)}>{a === "start" ? t("Start", "بداية") : a === "center" ? t("Center", "وسط") : t("End", "نهاية")}</button>)}
        </div>
        <div className="tp-segment" role="group" aria-label={t("Direction", "الاتجاه")}>
          {(["auto", "rtl", "ltr"] as const).map((d) => <button key={d} type="button" className={settings.direction === d ? "active" : ""} onClick={() => set("direction", d)}>{d === "auto" ? t("Auto", "تلقائي") : d === "rtl" ? "RTL ←" : "LTR →"}</button>)}
        </div>
        <label className="check"><input type="checkbox" checked={settings.mirrorX} onChange={(e) => set("mirrorX", e.target.checked)} />{t("Mirror (for teleprompter glass)", "عكس للمراية (زجاج التيليبرومبتر)")}</label>
        <label className="check"><input type="checkbox" checked={settings.mirrorY} onChange={(e) => set("mirrorY", e.target.checked)} />{t("Flip vertically", "قلب عمودي")}</label>
        <label className="check"><input type="checkbox" checked={settings.guide} onChange={(e) => set("guide", e.target.checked)} />{t("Reading guide line", "خط القراءة")}</label>
        <label>{t("Countdown", "العد التنازلي")}<select value={settings.countdown} onChange={(e) => set("countdown", Number(e.target.value))}>{[0, 3, 5, 10].map((n) => <option key={n} value={n}>{n ? `${n}s` : t("Off", "بدون")}</option>)}</select></label>
        <button type="button" className="secondary" onClick={() => setSettings(DEFAULTS)}>{t("Reset", "إعادة ضبط")}</button>
      </section>
    </div>

    <section className="panel tp-preview-wrap">
      <span className="eyebrow">{t("Preview", "معاينة")}</span>
      <div className="tp-preview" style={{ transform: mirror, paddingInline: `${settings.margin}%` }}>
        <BidiText paragraphs={paragraphs} auto={auto} style={{ ...textStyle, fontSize: `${Math.min(settings.fontSize, 40)}px` }} />
      </div>
    </section>

    {stage && createPortal(<div className={`tp-stage ${fontClassName}`} ref={stageRef}>
      <div className="tp-viewport" ref={viewportRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onWheel={(e) => nudge(e.deltaY * (settings.mirrorY ? -1 : 1))} onDoubleClick={toggle}>
        <div className="tp-mirror" style={{ transform: mirror }}>
          <div ref={contentRef} className="tp-scroll" style={{ paddingInline: `${settings.margin}%` }}>
            <BidiText paragraphs={paragraphs} auto={auto} style={textStyle} />
          </div>
          {settings.guide && <div className="tp-guide" aria-hidden="true" />}
        </div>
        {count > 0 && <div className="tp-count">{count}</div>}
      </div>
      <div className="tp-controls" dir={ar ? "rtl" : "ltr"}>
        <button type="button" onClick={closeStage} aria-label={t("Close", "إغلاق")}>✕</button>
        <button type="button" onClick={() => { offset.current = 0; applyOffset(); }} aria-label={t("Restart", "من البداية")}>⏮</button>
        <button type="button" className="tp-play" onClick={toggle}>{playing || count > 0 ? "❚❚" : "▶"}</button>
        <button type="button" onClick={() => set("speed", Math.max(5, settings.speed - 5))} aria-label={t("Slower", "أبطأ")}>−</button>
        <span className="tp-speed">{settings.speed}</span>
        <button type="button" onClick={() => set("speed", Math.min(300, settings.speed + 5))} aria-label={t("Faster", "أسرع")}>+</button>
        <button type="button" onClick={() => set("fontSize", Math.max(20, settings.fontSize - 4))} aria-label={t("Smaller text", "خط أصغر")}>A−</button>
        <button type="button" onClick={() => set("fontSize", Math.min(160, settings.fontSize + 4))} aria-label={t("Bigger text", "خط أكبر")}>A+</button>
        <button type="button" className={settings.mirrorX ? "active" : ""} onClick={() => set("mirrorX", !settings.mirrorX)} aria-label={t("Mirror", "عكس")}>⇋</button>
        <div className="tp-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      </div>
    </div>, document.body)}
  </div>;
}

function Range({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return <label className="tp-range">
    <span>{label}<b>{Number.isInteger(step) ? value : value.toFixed(2)}{unit}</b></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
  </label>;
}
