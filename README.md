# 24i Production Agency OS

Production-oriented Next.js/PostgreSQL foundation for agency operations. It includes a relational Prisma domain model, secure cookie sessions with Argon2id passwords, server-side RBAC/client isolation helpers, immutable content versions, separate visual/caption approvals, mandatory revision notes, slide-specific carousel notes, exact decimal payment accounting, append-only financial transactions/audits, push subscriptions, PWA shell and a responsive dashboard.

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

