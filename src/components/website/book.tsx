"use client";

import { useMemo } from "react";
import { basePath, site } from "@/lib/website/site";
import { MEETING_SLOTS, SERVICE_OPTIONS } from "@/lib/website/forms";
import { Field, Honeypot, SentCard, SubmitRow, useSubmit } from "./form-kit";
import { Reveal } from "./reveal";

const STEPS = ["Pick a day and time", "We confirm by email", "Meet in studio or on video"];

export function Book() {
  const { status, onSubmit, reset } = useSubmit(`${basePath}/api/book`);
  const err = status.fieldErrors ?? {};
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <Reveal as="section" id="book" aria-labelledby="book-title" className="relative overflow-hidden bg-cream px-6 py-24 text-ink sm:px-10 md:px-16 md:py-32">
      <div className="pointer-events-none absolute -right-[20vw] top-0 h-[60vw] w-[60vw] rounded-full bg-[radial-gradient(closest-side,rgba(0,140,140,0.18),transparent)]" />
      <div className="relative mx-auto grid max-w-[1400px] gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div>
          <p data-r className="font-mono text-xs uppercase tracking-[0.4em] text-teal">Book a meeting</p>
          <h2 id="book-title" className="font-wide mt-4 text-[clamp(2.6rem,6vw,6.5rem)] uppercase leading-[0.86]">
            <span className="mask block"><span data-r-line>Take one</span></span>
            <span className="mask block"><span data-r-line>with us<span className="text-teal">.</span></span></span>
          </h2>
          <p data-r className="mt-8 max-w-md text-ink/70">
            A 30 minute conversation to understand your goals and map the right mix of production, social, web, apps, systems and ads. All times are Lebanon time.
          </p>
          <ol className="mt-12 grid gap-4">
            {STEPS.map((s, i) => (
              <li data-r key={s} className="flex items-center gap-5 border-b border-ink/10 pb-4">
                <span className="font-mono text-xs text-teal">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-wide text-lg uppercase [font-stretch:110%]">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div data-r className="rounded-sm bg-ink p-6 text-cream shadow-[0_40px_100px_rgba(5,6,7,0.25)] sm:p-10">
          {site.bookingUrl ? (
            <iframe title="Book a meeting with 24i Production" src={site.bookingUrl} loading="lazy" className="h-[720px] w-full rounded-sm bg-cream" />
          ) : status.state === "sent" ? (
            <SentCard title="Request received" body="Your meeting request is in. We'll confirm the slot by email, or suggest the closest alternative." onReset={reset} />
          ) : (
            <form onSubmit={onSubmit} noValidate className="relative grid gap-8">
              <Honeypot />
              <div className="grid gap-8 sm:grid-cols-2">
                <Field name="name" label="Name" required autoComplete="name" error={err.name} />
                <Field name="email" label="Email" type="email" required autoComplete="email" error={err.email} />
              </div>
              <div className="grid gap-8 sm:grid-cols-2">
                <Field name="phone" label="Phone" type="tel" autoComplete="tel" error={err.phone} />
                <Field name="service" label="Topic" required error={err.service}>
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-ink">
                      {s}
                    </option>
                  ))}
                </Field>
              </div>
              <div className="grid gap-8 sm:grid-cols-3">
                <Field name="date" label="Date" type="date" required min={today} error={err.date} />
                <Field name="time" label="Time" required error={err.time}>
                  {MEETING_SLOTS.map((t) => (
                    <option key={t} value={t} className="bg-ink">
                      {t}
                    </option>
                  ))}
                </Field>
                <Field name="format" label="Format" required error={err.format}>
                  <option value="Studio visit" className="bg-ink">Studio visit</option>
                  <option value="Video call" className="bg-ink">Video call</option>
                </Field>
              </div>
              <Field name="notes" label="Anything we should know?" textarea error={err.notes} />
              <SubmitRow status={status} label="Request meeting" fallback={site.email ? <a className="underline" href={`mailto:${site.email}`}>{site.email}</a> : null} />
            </form>
          )}
        </div>
      </div>
    </Reveal>
  );
}
