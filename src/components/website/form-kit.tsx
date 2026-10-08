"use client";

import { useState, type FormEvent, type ReactNode } from "react";

export type Status = { state: "idle" | "sending" | "sent" | "error"; message?: string; fieldErrors?: Record<string, string>; data?: Record<string, unknown> };

const control =
  "peer w-full border-0 border-b border-cream/25 bg-transparent px-0 pb-3 pt-6 text-base text-cream outline-none transition-colors placeholder:text-transparent focus:border-teal-bright focus-visible:outline-none aria-[invalid=true]:border-rec [color-scheme:dark]";

export function Field({ name, label, type = "text", required, error, autoComplete, min, children, textarea, onChange }: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  error?: string;
  autoComplete?: string;
  min?: string;
  children?: ReactNode;
  textarea?: boolean;
  onChange?: (value: string) => void;
}) {
  const id = `f-${name}`;
  const common = { id, name, required, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-err` : undefined, onChange: onChange ? (e: { target: { value: string } }) => onChange(e.target.value) : undefined };
  return (
    <div className="relative">
      {children ? (
        <select {...common} className={`${control} appearance-none`} defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {children}
        </select>
      ) : textarea ? (
        <textarea {...common} rows={4} placeholder={label} className={`${control} resize-y`} />
      ) : (
        <input {...common} type={type} placeholder={label} autoComplete={autoComplete} min={min} className={control} />
      )}
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-0 top-0 font-mono text-[10px] uppercase tracking-[0.3em] text-mute"
      >
        {label}
        {required && <span className="text-teal-bright"> *</span>}
      </label>
      {error && (
        <p id={`${id}-err`} className="mt-2 text-xs text-rec">
          {error}
        </p>
      )}
    </div>
  );
}

/** Honeypot field hidden from people and assistive tech. */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

export function useSubmit(endpoint: string) {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus({ state: "sending" });
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } & Record<string, unknown>;
      if (res.ok && data.ok) {
        form.reset();
        setStatus({ state: "sent", data });
      } else {
        setStatus({ state: "error", message: data.error ?? "Something went wrong. Please try again.", fieldErrors: data.fieldErrors });
      }
    } catch {
      setStatus({ state: "error", message: "Network error. Please check your connection and try again." });
    }
  };
  return { status, onSubmit, reset: () => setStatus({ state: "idle" }) };
}

export function SubmitRow({ status, label, fallback }: { status: Status; label: string; fallback?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="submit"
        disabled={status.state === "sending"}
        className="group inline-flex items-center justify-center gap-3 rounded-full bg-cream px-8 py-4 font-mono text-xs uppercase tracking-[0.3em] text-ink transition hover:bg-teal-bright disabled:opacity-60"
      >
        <span className="h-2 w-2 rounded-full bg-rec transition group-hover:scale-125" />
        {status.state === "sending" ? "Sending…" : label}
      </button>
      <div aria-live="polite" className="text-sm">
        {status.state === "error" && (
          <p className="text-rec">
            {status.message} {fallback}
          </p>
        )}
      </div>
    </div>
  );
}

export function SentCard({ title, body, onReset }: { title: string; body: string; onReset: () => void }) {
  return (
    <div role="status" className="flex min-h-[320px] flex-col items-start justify-center gap-4 border border-cream/15 p-8">
      <span className="font-mono text-xs uppercase tracking-[0.4em] text-teal-bright">● That&apos;s a wrap</span>
      <p className="font-wide text-3xl uppercase">{title}</p>
      <p className="max-w-md text-cream/70">{body}</p>
      <button type="button" onClick={onReset} className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-mute underline-offset-4 hover:text-cream hover:underline">
        Send another
      </button>
    </div>
  );
}
