"use client";

import { FormEvent, useState } from "react";

export function FactoryReset({ ar = false }: { ar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const confirmText = String(form.get("confirm") || "").trim();
    if (confirmText !== "RESET") {
      setError(ar ? "اكتب RESET بالأحرف الكبيرة للتأكيد." : "Type RESET in capital letters to confirm.");
      return;
    }
    if (!window.confirm(ar ? "متأكد؟ رح ينمحى كل شي بشكل نهائي وما في رجعة." : "Are you sure? Everything will be permanently deleted and this cannot be undone.")) return;

    setBusy(true); setError(""); setDone("");
    try {
      const res = await fetch("/api/admin/factory-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: form.get("password"), confirm: confirmText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : ar ? "فشل إعادة الضبط" : "Reset failed");
      const left = data.leftInStorage ? (ar ? ` ${data.leftInStorage} ملف بقي بالتخزين، فيك تمحيه من لوحة التخزين.` : ` ${data.leftInStorage} file(s) remain in storage; delete them from your storage dashboard.`) : "";
      setDone((ar ? `تم. انمحى كل المحتوى و${data.removedUsers} حساب.` : `Done. All data and ${data.removedUsers} account(s) were deleted.`) + left);
      formEl.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : ar ? "فشل إعادة الضبط" : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel danger-zone">
    <div className="section-head"><div><span className="eyebrow">{ar ? "منطقة خطرة" : "Danger zone"}</span><h2>{ar ? "إعادة ضبط المصنع" : "Factory reset"}</h2></div><span className="badge badge-danger">{ar ? "للمدير فقط" : "Admin only"}</span></div>
    <p className="muted">{ar
      ? "بيمحي كل العملاء، المحتوى، الفيديوهات، المهام، التقويم، السكربتات، المالية، الإشعارات، وكل الحسابات ما عدا حسابات الأدمن. بيبقى: الأدمن، الأدوار والصلاحيات، وإعدادات الوكالة. ما في رجعة."
      : "Deletes all clients, content, videos, tasks, calendar, scripts, finance, notifications and every account except Admin accounts. Keeps: Admin accounts, roles and permissions, and agency settings. This cannot be undone."}</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    {done && <div className="notice success" role="status">{done}</div>}
    <form className="form-grid compact-form" onSubmit={submit}>
      <label>{ar ? "كلمة المرور تبعك" : "Your password"}<input name="password" type="password" autoComplete="current-password" required /></label>
      <label>{ar ? "اكتب RESET للتأكيد" : "Type RESET to confirm"}<input name="confirm" autoComplete="off" autoCapitalize="characters" required /></label>
      <button className="danger" disabled={busy}>{busy ? (ar ? "جارٍ المحو…" : "Deleting…") : (ar ? "امحِ كل البيانات" : "Delete all data")}</button>
    </form>
  </section>;
}
