"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };
type ScriptRow = {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  status: string;
  captionStatus: string;
  body: string;
  version: number;
  decisionNote?: string | null;
  updatedAt: string;
  byClient: boolean;
  authorName: string | null;
  mine: boolean;
};

type Props = {
  clients: ClientOption[];
  scripts: ScriptRow[];
  isClient: boolean;
  canWrite: boolean;
  ar?: boolean;
};

async function parseResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : data.error?.formErrors?.[0] || "Request failed";
    throw new Error(message);
  }
  return data;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure contexts: fall back to a temporary textarea.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function CopyButton({ text, ar }: { text: string; ar: boolean }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    setState((await copyText(text)) ? "done" : "failed");
    setTimeout(() => setState("idle"), 2000);
  }
  return <button type="button" className={`secondary copy-script${state === "done" ? " copied" : ""}`} onClick={() => void copy()}>
    {state === "done" ? (ar ? "✓ تم النسخ" : "✓ Copied") : state === "failed" ? (ar ? "تعذّر النسخ" : "Copy failed") : (ar ? "نسخ السكربت" : "Copy script")}
  </button>;
}

export function ScriptWorkflow({ clients, scripts, isClient, canWrite, ar = false }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [revisionOpen, setRevisionOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>(
    Object.fromEntries(scripts.map((script) => [script.id, { title: script.title, body: script.body }]))
  );

  async function createScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusyId("new");
    setMessage("");
    try {
      const response = await fetch("/api/scripts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: data.get("clientId"),
          title: data.get("title"),
          body: data.get("body"),
        }),
      });
      await parseResponse(response);
      setMessage(isClient ? (ar ? "تم إرسال السكربت للفريق." : "Script sent to the team.") : (ar ? "تم إرسال السكربت للعميل للموافقة." : "Script sent to the client for approval."));
      form.reset();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ar ? "تعذّر إرسال السكربت." : "Could not send script."));
    } finally {
      setBusyId(null);
    }
  }

  async function decide(scriptId: string, decision: "APPROVED" | "REVISION_REQUESTED") {
    const note = notes[scriptId]?.trim() || "";
    if (decision === "REVISION_REQUESTED" && !note) {
      setMessage(ar ? "اكتب ملاحظات التعديل قبل الإرسال." : "Write the revision notes before sending.");
      return;
    }
    setBusyId(scriptId);
    setMessage("");
    try {
      const response = await fetch(`/api/scripts/${scriptId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "DECIDE", decision, note: note || undefined }),
      });
      await parseResponse(response);
      setMessage(
        decision === "APPROVED"
          ? (ar ? "تمت الموافقة على السكربت." : "Script approved.")
          : (ar ? "تم إرسال ملاحظاتك للفريق." : "Your revision notes were sent to the team.")
      );
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ar ? "تعذّر حفظ القرار." : "Could not save decision."));
    } finally {
      setBusyId(null);
    }
  }

  async function resend(scriptId: string) {
    const draft = drafts[scriptId];
    if (!draft?.title.trim() || !draft?.body.trim()) return;
    setBusyId(scriptId);
    setMessage("");
    try {
      const response = await fetch(`/api/scripts/${scriptId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "RESEND", title: draft.title, body: draft.body }),
      });
      await parseResponse(response);
      setMessage(isClient ? (ar ? "تم حفظ التعديلات وإبلاغ الفريق." : "Changes saved and the team was notified.") : (ar ? "تم تعديل السكربت وإرساله من جديد للعميل." : "Script revised and resent to the client."));
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ar ? "تعذّر إعادة إرسال السكربت." : "Could not resend script."));
    } finally {
      setBusyId(null);
    }
  }

  return <div className="management-stack">
    {message && <div className="notice">{message}</div>}

    {canWrite && !isClient && <section className="panel">
      <span className="eyebrow">{ar ? "سكربت جديد" : "NEW SCRIPT"}</span>
      <h2>{ar ? "اكتب السكربت وأرسله للعميل" : "Write a script & send it to the client"}</h2>
      <form className="compact-form" onSubmit={createScript}>
        <label>{ar ? "العميل" : "Client"}
          <select name="clientId" required>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.brandName}</option>)}
          </select>
        </label>
        <label>{ar ? "عنوان السكربت" : "Script title"}<input name="title" required placeholder={ar ? "مثلاً: Reel 1 - نصائح الصيف" : "e.g. Reel 1 - Summer tips"} /></label>
        <label>{ar ? "السكربت" : "Script"}<textarea name="body" rows={12} required placeholder={ar ? "اكتب السكربت كامل هون…" : "Write the full script here…"} /></label>
        <button disabled={busyId === "new" || !clients.length}>{busyId === "new" ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال للعميل للموافقة" : "Send to client for approval")}</button>
      </form>
    </section>}

    {isClient && clients.length > 0 && <section className="panel">
      <span className="eyebrow">{ar ? "سكربت جديد" : "NEW SCRIPT"}</span>
      <h2>{ar ? "اكتب سكربت وأرسله للفريق" : "Write a script for the team"}</h2>
      <p className="muted">{ar ? "عندك فكرة أو سكربت جاهز؟ اكتبه هون وبيوصل للفريق مباشرة." : "Have an idea or a ready script? Write it here and it goes straight to the team."}</p>
      <form className="compact-form" onSubmit={createScript}>
        {clients.length > 1
          ? <label>{ar ? "الشركة" : "Company"}<select name="clientId" required>{clients.map((client) => <option key={client.id} value={client.id}>{client.brandName}</option>)}</select></label>
          : <input type="hidden" name="clientId" value={clients[0].id} />}
        <label>{ar ? "عنوان السكربت" : "Script title"}<input name="title" required placeholder={ar ? "مثلاً: Reel 1 - نصائح الصيف" : "e.g. Reel 1 - Summer tips"} /></label>
        <label>{ar ? "السكربت" : "Script"}<textarea name="body" rows={10} required placeholder={ar ? "اكتب السكربت أو الفكرة هون…" : "Write the script or idea here…"} /></label>
        <button disabled={busyId === "new"}>{busyId === "new" ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال للفريق" : "Send to the team")}</button>
      </form>
    </section>}

    {scripts.map((script) => {
      const waiting = script.status === "WAITING_CLIENT_APPROVAL";
      const revision = script.status === "REVISION_REQUESTED";
      const approved = script.status === "APPROVED";
      const draft = drafts[script.id] || { title: script.title, body: script.body };

      return <section className="panel" id={script.id} key={script.id}>
        <div className="section-head">
          <div>
            <span className="eyebrow">{isClient ? script.clientName : `${script.clientName} · SCRIPT V${script.version}`}</span>
            <h2>{script.title}</h2>
          </div>
          <div className="script-head-actions">
          {!isClient && script.body && <CopyButton text={script.body} ar={ar} />}
          {script.byClient
            ? <span className="badge badge-accent">{script.mine ? (ar ? "كتبته أنت" : "Written by you") : `${ar ? "من العميل" : "From client"}${script.authorName ? ` · ${script.authorName}` : ""}`}</span>
            : <span className="muted">{approved ? (ar ? "موافق عليه" : "Approved") : revision ? (ar ? "مطلوب تعديل" : "Revision requested") : (ar ? "بانتظار العميل" : "Waiting for client")}</span>}
          </div>
        </div>

        {isClient && script.mine && editing === script.id
          ? <div className="compact-form">
              <label>{ar ? "العنوان" : "Title"}<input value={draft.title} onChange={(event) => setDrafts((current) => ({ ...current, [script.id]: { ...draft, title: event.target.value } }))} /></label>
              <label>{ar ? "السكربت" : "Script"}<textarea rows={10} value={draft.body} onChange={(event) => setDrafts((current) => ({ ...current, [script.id]: { ...draft, body: event.target.value } }))} /></label>
              <div className="review-actions">
                <button type="button" className="secondary" onClick={() => setEditing(null)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button type="button" disabled={busyId === script.id} onClick={() => void resend(script.id)}>{busyId === script.id ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ التعديلات" : "Save changes")}</button>
              </div>
            </div>
          : (!revision || !canWrite) && <div className="client-caption-preview"><p>{script.body}</p></div>}
        {isClient && script.mine && editing !== script.id && <div className="review-actions"><button type="button" className="secondary" onClick={() => setEditing(script.id)}>{ar ? "تعديل" : "Edit"}</button></div>}

        {script.decisionNote && <div className="feedback-box revision-feedback"><b>{ar ? "ملاحظات العميل" : "Client notes"}</b><p>{script.decisionNote}</p></div>}

        {isClient && waiting && <>
          {revisionOpen !== script.id ? <div className="review-actions">
            <button type="button" disabled={busyId === script.id} onClick={() => void decide(script.id, "APPROVED")}>{ar ? "موافق" : "Approve"}</button>
            <button type="button" className="revision-button" disabled={busyId === script.id} onClick={() => setRevisionOpen(script.id)}>{ar ? "غير موافق / طلب تعديل" : "Not approved / Request changes"}</button>
          </div> : <div className="panel revision-feedback">
            <span className="eyebrow">{ar ? "ملاحظات التعديل" : "REVISION NOTES"}</span>
            <textarea rows={5} autoFocus value={notes[script.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [script.id]: event.target.value }))} placeholder={ar ? "شو بدك يتعدّل؟" : "What needs to change?"} />
            <div className="review-actions">
              <button type="button" className="secondary" onClick={() => setRevisionOpen(null)}>{ar ? "رجوع" : "Back"}</button>
              <button type="button" className="revision-button" disabled={busyId === script.id} onClick={() => void decide(script.id, "REVISION_REQUESTED")}>{busyId === script.id ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "إرسال الملاحظات" : "Send notes")}</button>
            </div>
          </div>}
        </>}

        {canWrite && revision && <div className="compact-form">
          <label>{ar ? "العنوان المعدّل" : "Updated title"}<input value={draft.title} onChange={(event) => setDrafts((current) => ({ ...current, [script.id]: { ...draft, title: event.target.value } }))} /></label>
          <label>{ar ? "السكربت المعدّل" : "Revised script"}<textarea rows={12} value={draft.body} onChange={(event) => setDrafts((current) => ({ ...current, [script.id]: { ...draft, body: event.target.value } }))} /></label>
          <button type="button" disabled={busyId === script.id} onClick={() => void resend(script.id)}>{busyId === script.id ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "حفظ وإعادة الإرسال للعميل" : "Save & resend to client")}</button>
        </div>}
      </section>;
    })}

    {!scripts.length && <section className="panel"><p>{ar ? "ما في سكربتات بعد." : "No scripts yet."}</p></section>}
  </div>;
}
