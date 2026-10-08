"use client";

import { basePath, site } from "@/lib/website/site";
import { SERVICE_OPTIONS } from "@/lib/website/forms";
import { Field, Honeypot, SentCard, SubmitRow, useSubmit } from "./form-kit";
import { Reveal } from "./reveal";

export function Contact() {
  const { status, onSubmit, reset } = useSubmit(`${basePath}/api/contact`);
  const err = status.fieldErrors ?? {};
  const channels = [
    site.email && { label: "Email", value: site.email, href: `mailto:${site.email}` },
    site.phone && { label: "Phone", value: site.phone, href: `tel:${site.phone.replace(/[^+\d]/g, "")}` },
    site.whatsapp && { label: "WhatsApp", value: site.whatsapp, href: `https://wa.me/${site.whatsapp.replace(/\D/g, "")}` },
    site.instagram && { label: "Instagram", value: `@${site.instagram.replace(/^@/, "")}`, href: `https://instagram.com/${site.instagram.replace(/^@/, "")}` },
  ].filter(Boolean) as { label: string; value: string; href: string }[];

  return (
    <Reveal as="section" id="contact" aria-labelledby="contact-title" className="relative border-t border-cream/10 bg-ink px-6 py-24 sm:px-10 md:px-16 md:py-32">
      <div className="mx-auto grid max-w-[1400px] gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div>
          <p data-r className="font-mono text-xs uppercase tracking-[0.4em] text-teal-bright">Contact us</p>
          <h2 id="contact-title" className="font-wide mt-4 text-[clamp(2.6rem,6vw,6.5rem)] uppercase leading-[0.86]">
            <span className="mask block"><span data-r-line>Tell us</span></span>
            <span className="mask block"><span data-r-line>the story<span className="text-teal-bright">.</span></span></span>
          </h2>
          <p data-r className="mt-8 max-w-md text-cream/70">
            A launch, a campaign, a platform or a full rebrand. Share what you have in mind and the team will get back to you shortly.
          </p>
          {channels.length > 0 && (
            <ul className="mt-12 divide-y divide-cream/10 border-y border-cream/10">
              {channels.map((c) => (
                <li data-r key={c.label}>
                  <a href={c.href} className="group flex items-center justify-between py-4" target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-mute">{c.label}</span>
                    <span className="text-lg transition group-hover:text-teal-bright">{c.value}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div data-r>
          {status.state === "sent" ? (
            <SentCard title="Message received" body="Thanks for reaching out. We'll reply to your email shortly." onReset={reset} />
          ) : (
            <form onSubmit={onSubmit} noValidate className="relative grid gap-8">
              <Honeypot />
              <div className="grid gap-8 sm:grid-cols-2">
                <Field name="name" label="Name" required autoComplete="name" error={err.name} />
                <Field name="email" label="Email" type="email" required autoComplete="email" error={err.email} />
              </div>
              <div className="grid gap-8 sm:grid-cols-2">
                <Field name="phone" label="Phone" type="tel" autoComplete="tel" error={err.phone} />
                <Field name="service" label="Service" required error={err.service}>
                  {SERVICE_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-ink">
                      {s}
                    </option>
                  ))}
                </Field>
              </div>
              <Field name="message" label="Message" textarea required error={err.message} />
              <SubmitRow status={status} label="Send message" fallback={site.email ? <a className="underline" href={`mailto:${site.email}`}>{site.email}</a> : null} />
            </form>
          )}
        </div>
      </div>
    </Reveal>
  );
}
