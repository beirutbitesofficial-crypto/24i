"use client";

import { useEffect, useRef, useState } from "react";

type PushState = "hidden" | "install" | "prompt" | "denied" | "error";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

async function saveSubscription(registration: ServiceWorkerRegistration) {
  const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
  const keyData = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !keyData.publicKey) throw new Error("Push notifications are not configured on the server.");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(keyData.publicKey),
    });
  }

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("Could not register this device for notifications.");
}

export function PwaRegister() {
  const [state, setState] = useState<PushState>("hidden");
  const [busy, setBusy] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
      try {
        const config = await fetch("/api/push/public-key", { cache: "no-store" });
        if (config.status === 401) return;
        if (!config.ok) {
          if (active) setState("error");
          return;
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        registration.current = reg;

        if (Notification.permission === "granted") {
          await saveSubscription(reg);
          if (active) setState("hidden");
          return;
        }
        if (Notification.permission === "denied") {
          if (active) setState("denied");
          return;
        }
        if (isIOS() && !isStandalone()) {
          if (active) setState("install");
          return;
        }

        // Installed web app: show our permission modal immediately on first/open launch.
        if (active) setState("prompt");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  async function enable() {
    if (!registration.current) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await saveSubscription(registration.current);
        setState("hidden");
      } else if (permission === "denied") {
        setState("denied");
      }
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  if (state === "hidden") return null;

  if (state === "install") {
    return <div className="push-install-hint" role="status">
      <b>Add 24i to Home Screen</b>
      <span>Open it from the Home Screen to enable notifications.</span>
    </div>;
  }

  return <div className="push-modal-backdrop" role="dialog" aria-modal="true" aria-label="24i notifications">
    <section className="push-modal">
      <img src="/api/app-icon?v=3" alt="24i Production" className="push-modal-logo" />
      <div className="push-modal-copy">
        <span className="eyebrow">24i PRODUCTION</span>
        <h2>{state === "denied" ? "Notifications are blocked" : state === "error" ? "Notifications need setup" : "Allow notifications?"}</h2>
        <p>{state === "denied" ? "Enable notifications for 24i from your iPhone Settings to receive alerts." : state === "error" ? "Push notifications are not fully configured on the server yet." : "Get instant alerts for approvals, revisions, captions and assigned tasks even when 24i is closed."}</p>
      </div>
      {state === "prompt" ? <div className="push-modal-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => setState("hidden")}>Not now</button>
        <button type="button" disabled={busy} onClick={() => void enable()}>{busy ? "Enabling…" : "Allow notifications"}</button>
      </div> : <button type="button" className="secondary" onClick={() => setState("hidden")}>Close</button>}
    </section>
  </div>;
}
