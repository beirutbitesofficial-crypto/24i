"use client";

import { FormEvent, useState } from "react";
import { CreatePanel, Notice } from "@/components/ui";

type ClientOption = { id: string; brandName: string };

export function FileUploader({ clients, storageReady }: { clients: ClientOption[]; storageReady: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const f = new FormData(e.currentTarget);
    const clientId = String(f.get("clientId") || "");
    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) { setBusy(false); setMessage("Choose a file first."); return; }
    const type = file.type || "application/octet-stream";
    try {
      const sign = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, name: file.name, type, size: file.size }) });
      const signed = await sign.json();
      if (!sign.ok) throw new Error(signed.error === "UNSUPPORTED_FILE_TYPE" ? "This file type is not supported." : signed.error === "INVALID_FILE_SIZE" ? "Files must be under 500 MB." : signed.error || "Could not prepare upload");
      const put = await fetch(signed.url, { method: "PUT", headers: { "content-type": type }, body: file });
      if (!put.ok) throw new Error("Upload to storage failed");
      const complete = await fetch("/api/uploads/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, key: signed.key, originalName: file.name }) });
      const done = await complete.json();
      if (!complete.ok) throw new Error(typeof done.error === "string" ? done.error : "Could not register file");
      setMessage("File uploaded.");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Upload failed"); }
    finally { setBusy(false); }
  }

  return <CreatePanel title="Upload file" hint="Images, video, audio or PDF · up to 500 MB">
    {!storageReady && <div className="notice">Storage credentials are not configured yet, so uploads are disabled.</div>}
    <Notice message={message} />
    <form className="form-grid compact-form" onSubmit={submit}>
      <label>Client<select name="clientId" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label>
      <label>File<input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf,audio/mpeg,audio/wav" required /></label>
      <button disabled={busy || !storageReady || !clients.length}>{busy ? "Uploading…" : "Upload file"}</button>
    </form>
  </CreatePanel>;
}
