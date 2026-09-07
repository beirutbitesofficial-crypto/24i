"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };

function putFileWithProgress(
  url: string,
  file: File,
  mimeType: string,
  onProgress: (percent: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.send(file);
  });
}

export function FileUploader({
  clients,
  storageReady,
}: {
  clients: ClientOption[];
  storageReady: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setProgress(0);

    const form = e.currentTarget;
    const data = new FormData(form);
    const clientId = String(data.get("clientId") || "");
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      setBusy(false);
      setProgress(null);
      setMessage("Choose a file first.");
      return;
    }

    try {
      const mimeType = file.type || "application/octet-stream";
      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, name: file.name, type: mimeType, size: file.size }),
      });
      const signed = await sign.json().catch(() => ({}));
      if (!sign.ok) throw new Error(signed.error || "Could not prepare upload");

      await putFileWithProgress(signed.url, file, mimeType, setProgress);

      const complete = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          key: signed.key,
          originalName: file.name,
          mimeType,
          size: String(file.size),
        }),
      });
      const done = await complete.json().catch(() => ({}));
      if (!complete.ok) throw new Error(done.error || "Could not register file");

      setProgress(100);
      setMessage("File uploaded.");
      window.location.reload();
    } catch (err) {
      setProgress(null);
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <span className="eyebrow">UPLOAD</span>
      <h2>File library</h2>
      {!storageReady && (
        <div className="notice">
          Storage credentials are not configured yet. File permissions are ready, but uploads will stay disabled.
        </div>
      )}
      {message && <div className="notice">{message}</div>}
      <form className="form-grid compact-form" onSubmit={submit}>
        <label>
          Client
          <select name="clientId" required>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.brandName}</option>
            ))}
          </select>
        </label>
        <label>
          File
          <input name="file" type="file" required />
        </label>

        {progress !== null && (
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 7 }} aria-live="polite">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span className="muted">Uploading file</span>
              <strong>{progress}%</strong>
            </div>
            <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "var(--line)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, var(--green), var(--lime))",
                  transition: "width .16s ease",
                }}
              />
            </div>
          </div>
        )}

        <button disabled={busy || !storageReady || !clients.length}>
          {busy ? `Uploading… ${progress ?? 0}%` : "Upload file"}
        </button>
      </form>
    </section>
  );
}
