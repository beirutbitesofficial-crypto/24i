"use client";

import Link from "next/link";
import { useState } from "react";

export function SignupForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return <form
    onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            brandName: form.get("brandName"),
            email: form.get("email"),
            phone: form.get("phone") || undefined,
            password: form.get("password"),
            confirmPassword: form.get("confirmPassword"),
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not create account");
        window.location.href = "/";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create account");
      } finally {
        setBusy(false);
      }
    }}
  >
    <label>
      Your name
      <input name="name" autoComplete="name" minLength={2} required />
    </label>
    <label>
      Brand / Company name
      <input name="brandName" minLength={2} required />
    </label>
    <label>
      Email
      <input name="email" type="email" autoComplete="email" required />
    </label>
    <label>
      Phone <span className="muted">(optional)</span>
      <input name="phone" type="tel" autoComplete="tel" />
    </label>
    <label>
      Password
      <input name="password" type="password" autoComplete="new-password" minLength={8} required />
    </label>
    <label>
      Confirm password
      <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
    </label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? "Creating account…" : "Create client account"}</button>
    <p className="muted">Already have an account? <Link href="/">Sign in</Link></p>
  </form>;
}
