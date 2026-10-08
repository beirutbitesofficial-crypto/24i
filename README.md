# 24i Production Agency OS

Production-oriented Next.js/PostgreSQL foundation for agency operations. It includes a relational Prisma domain model, secure cookie sessions with Argon2id passwords, server-side RBAC/client isolation helpers, immutable content versions, separate visual/caption approvals, mandatory revision notes, slide-specific carousel notes, exact decimal payment accounting, append-only financial transactions/audits, push subscriptions, PWA shell and a responsive dashboard.

## Public website (`/website`)

The public marketing site is part of this app and is deployed with it: `24iproduction.com` opens the system and `24iproduction.com/website` opens the site. Its code lives in `src/app/(website)/website`, `src/components/website` and `src/lib/website`. It has its own root layout and Tailwind stylesheet, so it never shares CSS with the system (which lives in the `src/app/(system)` route group).

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4 and GSAP ScrollTrigger. Fonts (Archivo, Inter, JetBrains Mono) are self-hosted through Fontsource.

### Page structure

1. **Cinematic eye intro.** A realistic SVG eye follows the pointer and blinks while the page is idle.
2. **Eye-to-camera transformation.** Scrolling makes the eye blink twice. On the second blink it opens as a lens. A match cut then pulls back to a layered 3D cinema camera, which swings round.
3. **Camera recording activation.** The camera powers on (LEDs and monitor), the record button is pressed, the tally light turns red and a REC timecode appears. The view then dives through the lens into a full-screen viewfinder showing ROLLING, then CUT. The viewfinder falls away and leaves the aperture.
4. **Full-screen services presentation.** One pinned, scrubbed ScrollTrigger deck with six 100svh slides. Each slide has its own visual and its own transition: hex aperture, vertical wipe, perspective shift, diagonal wipe, centre split and push-through. A live 0X / 06 counter and a progress bar sit at the bottom.
5. **Location.** A dark-styled map embed, Beirut local time and a directions link.
6. **Contact Us.** A validated form posts to `/website/api/contact`.
7. **Book a Meeting.** A built-in request form posts to `/website/api/book`. If `NEXT_PUBLIC_BOOKING_URL` is set, a Cal.com or Calendly embed is shown instead.
8. **Minimal footer.**

#### Motion and accessibility

- With `prefers-reduced-motion: reduce`, nothing is pinned or scrubbed. The intro shows a still powered-on camera, and the slides stack as normal full-height sections.
- Without JavaScript, the slides also render as stacked sections, so all service content stays in the HTML.
- Pinned sections have a fixed length: about 4.6 viewports for the intro and 6.4 for the deck. There is no snapping, and touch scrolling stays native. A **Skip intro** button and the nav links jump straight to any section.

### Configuration

The `NEXT_PUBLIC_*` contact fields and the form delivery settings are in `.env.example`. Contact channels only appear when they are set. In production, set `RESEND_API_KEY` + `FORM_TO_EMAIL` and/or `FORM_WEBHOOK_URL`. If neither is set, submissions return a 503 with a "reach us directly" message, so no enquiry is silently lost.

## Local setup

1. Install Node.js 22+, PostgreSQL 16+, and an S3-compatible object store.
2. Copy `.env.example` to `.env` and replace every secret. Generate VAPID keys with `npx web-push generate-vapid-keys`.
3. Run `npm ci`, `npx prisma migrate dev --name initial`, then set `ADMIN_EMAIL` and `ADMIN_PASSWORD` and run `npm run db:seed`.
4. Run `npm test` and `npm run dev`.

Production uses `npm run db:migrate`, then `npm run build && npm start`. Terminate TLS at a trusted proxy, enforce HTTPS, set secure secrets through the platform secret manager, and schedule authenticated cron endpoints in the `Asia/Beirut` timezone. Object upload endpoints should issue short-lived, content-type/size constrained presigned URLs; downloads must authorize the file's client scope before issuing a short-lived URL.

## Deployment and operations

- Deploy the web service and worker separately; use managed PostgreSQL with point-in-time recovery and multi-zone storage.
- Nightly encrypted database snapshots, 35-day retention, weekly restore drill. Enable object versioning, lifecycle retention and cross-region replication. Restoration order: database to timestamp, object bucket version, application release; validate row counts and sampled checksums before reopening writes.
- Configure VAPID public/private keys and serve over HTTPS. The service worker handles background push and deep links. iOS requires installation to the home screen and user-granted notification permission.
- Run recurring task expansion, overdue alerts, daily summaries and publishing reminders from a server scheduler, authenticated with `CRON_SECRET`; never from browser timers.
- Financial corrections should create reversal transactions and set `reversedAt`; do not delete payments, expenses, salary payments, transactions or audit logs.

## Security/launch checklist

- Rotate all example secrets; least-privilege database and bucket credentials.
- Add distributed rate limiting at the proxy/Redis layer for login, password reset and upload signing.
- Configure CSP for actual storage/CDN domains, malware scanning, MIME sniff protection and upload quotas.
- Verify RBAC and client isolation tests against a migrated PostgreSQL test database.
- Configure email delivery for password reset, push keys, scheduler, backups, error monitoring and audit retention.
- Complete accessibility, Arabic/RTL, browser/device, load, disaster-recovery and the 42-step acceptance workflow before production launch.

## Scope status

This repository is a working foundation, not a truthful claim that all 71 sections of the supplied specification are complete. The current execution host lacked Node/npm and its TLS layer blocked downloading them, so migrations, build and tests could not be run here. Remaining production modules include password-reset email delivery, S3 upload/signing, notification fan-out, reports, calendars, full bilingual UI, finance screens, scheduled worker routes and the complete acceptance suite.

