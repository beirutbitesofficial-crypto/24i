"use client";

import Link from "next/link";
import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");

        try {
          const form = new FormData(e.currentTarget);
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: form.get("email"),
              password: form.get("password"),
            }),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || "Unable to sign in");
            return;
          }

          // Reload once after authentication so PwaRegister runs with the
          // signed-in session and saves this browser/device subscription.
          window.location.href = "/";
        } catch {
          setError("Server unavailable. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="muted">New client? <Link href="/signup">Create an account</Link></p>
    </form>
  );
}
