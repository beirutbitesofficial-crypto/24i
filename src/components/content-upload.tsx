"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContentUpload({ contentId, clientId, currentVersion }: { contentId: string; clientId: string; currentVersion: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload() {
    if (!file) return setMessage("Choose a video or image first.");
    setBusy(true);
    setMessage("Preparing upload...");
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name: file.name, type: file.type, size: file.size })
      });
      if (!signRes.ok) throw new Error("Could not create upload URL.");
      const signed = await signRes.json();

      setMessage("Uploading file...");
      const putRes = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putRes.ok) throw new Error("File upload failed.");

      setMessage("Saving file...");
      const completeRes = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, contentId, key: signed.key, originalName: file.name, mimeType: file.type, size: String(file.size) })
      });
      if (!completeRes.ok) throw new Error("Could not save uploaded file.");
      const saved = await completeRes.json();

      setMessage("Sending to client for approval...");
      const versionRes = await fetch(`/api/content/${contentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: saved.id, notes: notes.trim() || undefined })
      });
      if (!versionRes.ok) throw new Error("Could not submit this version for approval.");

      setFile(null);
      setNotes("");
      setMessage(`V${currentVersion + 1} sent to the client. Notification created.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="upload-box">
    <h3>Upload new version</h3>
    <p>Upload the final video/image. The client will be notified automatically.</p>
    <input type="file" accept="video/*,image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional internal note about this version..." rows={3} />
    {message && <p className="form-message">{message}</p>}
    <button disabled={busy || !file} onClick={upload}>{busy ? "Uploading..." : `Upload & send for approval`}</button>
  </div>;
}
