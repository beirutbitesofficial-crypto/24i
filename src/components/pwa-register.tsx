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
  return <div className="push-setup" role="status">
    <div>
      <b>{state === "install" ? "Install 24i first" : state === "denied" ? "Notifications are blocked" : state === "error" ? "Notifications need setup" : "Turn on notifications"}</b>
      <span>{state === "install" ? "Add 24i to your Home Screen, open the app, then enable notifications." : state === "denied" ? "Allow notifications for 24i from your iPhone settings." : state === "error" ? "Check the VAPID settings on Hostinger and try again." : "Get approval, revision and task alerts even when the app is closed."}</span>
    </div>
    {state === "prompt" && <button type="button" disabled={busy} onClick={() => void enable()}>{busy ? "Enabling…" : "Enable notifications"}</button>}
  </div>;
}
