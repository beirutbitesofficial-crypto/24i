"use client";

import { useMemo, useState } from "react";

type ClientOption = { id: string; brandName: string };
type PlanItem = { type: "REEL" | "STATIC_POST"; date: string; title: string };

function daysInMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

function dayString(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function alternateTypes(posts: number, reels: number) {
  const result: Array<"REEL" | "STATIC_POST"> = [];
  let p = posts;
  let r = reels;
  let next: "REEL" | "STATIC_POST" = r >= p ? "REEL" : "STATIC_POST";
  while (p > 0 || r > 0) {
    if (next === "REEL" && r > 0) {
      result.push("REEL"); r -= 1;
    } else if (next === "STATIC_POST" && p > 0) {
      result.push("STATIC_POST"); p -= 1;
    } else if (r > 0) {
      result.push("REEL"); r -= 1;
    } else if (p > 0) {
      result.push("STATIC_POST"); p -= 1;
    }
    next = next === "REEL" ? "STATIC_POST" : "REEL";
  }
  return result;
}

export function MonthlyContentPlanner({ clients, month, ar = false }: { clients: ClientOption[]; month: string; ar?: boolean }) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [posts, setPosts] = useState(0);
  const [reels, setReels] = useState(0);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const total = useMemo(() => posts + reels, [posts, reels]);

  function buildPlan() {
    setMessage("");
    if (total < 1) {
      setMessage(ar ? "حط عدد البوستات أو الريلز أولاً." : "Add at least one post or reel first.");
      return;
    }
    if (total > 60) {
      setMessage(ar ? "الحد الأقصى 60 قطعة محتوى بالشهر." : "Maximum 60 content pieces per month.");
      return;
    }

    const types = alternateTypes(posts, reels);
    const maxDay = daysInMonth(month);
    let reelIndex = 0;
    let postIndex = 0;
    const nextItems = types.map((type, index) => {
      const day = Math.max(1, Math.min(maxDay, Math.round(((index + 1) * maxDay) / (types.length + 1))));
      if (type === "REEL") reelIndex += 1; else postIndex += 1;
      return {
        type,
        date: dayString(month, day),
        title: type === "REEL" ? `Reel ${reelIndex}` : `Post ${postIndex}`,
      };
    });
    setItems(nextItems);
  }

  function updateItem(index: number, patch: Partial<PlanItem>) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function savePlan() {
    if (!clientId || !items.length) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/calendar/month-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, month, items }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save monthly plan");
      setMessage(ar ? "تم حفظ خطة الشهر بالتقويم." : "Monthly plan saved to the calendar.");
      window.location.href = `/calendar?month=${month}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ar ? "تعذّر حفظ الخطة." : "Could not save plan."));
    } finally {
      setBusy(false);
    }
  }

  if (!clients.length) return null;

  return <section className="panel monthly-planner">
    <div className="section-head">
      <div>
        <span className="eyebrow">{ar ? "خطة الشهر" : "MONTHLY PLAN"}</span>
        <h2>{ar ? "وزّع البوستات والريلز على التقويم" : "Plan posts & reels by date"}</h2>
      </div>
      <span className="muted">{month}</span>
    </div>

    {message && <div className="notice">{message}</div>}

    <div className="form-grid compact-form">
      <label>{ar ? "العميل" : "Client"}
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.brandName}</option>)}
        </select>
      </label>
      <label>{ar ? "عدد البوستات" : "Posts"}
        <input type="number" min={0} max={60} value={posts} onChange={(e) => setPosts(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <label>{ar ? "عدد الريلز" : "Reels"}
        <input type="number" min={0} max={60} value={reels} onChange={(e) => setReels(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      <button type="button" onClick={buildPlan}>{ar ? `إنشاء ${total} مواعيد` : `Build ${total} slots`}</button>
    </div>

    {items.length > 0 && <div className="monthly-plan-items">
      {items.map((item, index) => <article className="monthly-plan-row" key={`${item.type}-${index}`}>
        <span className="plan-number">{index + 1}</span>
        <select value={item.type} onChange={(e) => updateItem(index, { type: e.target.value as PlanItem["type"] })}>
          <option value="REEL">Reel</option>
          <option value="STATIC_POST">Post</option>
        </select>
        <input value={item.title} onChange={(e) => updateItem(index, { title: e.target.value })} placeholder={ar ? "عنوان المحتوى" : "Content title"} />
        <input type="date" min={`${month}-01`} max={`${month}-${String(daysInMonth(month)).padStart(2, "0")}`} value={item.date} onChange={(e) => updateItem(index, { date: e.target.value })} />
      </article>)}
      <button type="button" disabled={busy} onClick={() => void savePlan()}>{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ خطة الشهر" : "Save monthly plan")}</button>
    </div>}
  </section>;
}
