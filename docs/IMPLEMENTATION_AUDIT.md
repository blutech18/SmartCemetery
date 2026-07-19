# Smart Cemetery Implementation Audit
**Audit date:** 2026-07-15
**Source of truth:** `docs/Smart_Cemetery.md`
**Method:** Static review plus Prisma, lint, unit/integration, build, live-MySQL, restore, dependency, and browser validation. Generated output, dependencies, lockfiles, assets, and secret values were excluded from content review.
## Executive assessment
The listed remediation workflows are now **implemented and locally verified**: Staff verification, Admin grave/location operations, advanced search, server-side routing, kiosk navigation, SMTP/broadcasts, durable archival scheduling, privacy-safe analytics with CSV/PDF/XLSX, encryption lifecycle tooling, database-backed throttling, live-MySQL constraints, authenticated role journeys, and CI gates.
The platform is **not yet approved for production release**. Remaining gates require real infrastructure or operational evidence: approved Bolonsori walkways and production tile/routing hosts, a real SMTP mailbox smoke, archival secrets and an observed scheduled run, backed-up staging encryption rotation, remote CI observation, and final accessibility/security/performance/deployment approval.
## Coverage matrix
| Capability | Status | Evidence / remaining gate |
|---|---|---|
| Next.js UI + API architecture | Implemented | Public, kiosk, Client, Staff, and Admin App Router surfaces exist. |
| MySQL model and migrations | Implemented; locally verified | All five migrations are applied to `cemetery_map`; the fresh chain also passed on isolated `cemetery_test`. |
| Authentication and RBAC | Implemented; locally verified | API guards recheck account/role state; database-backed login throttling fails closed and successful login clears its hashed bucket. |
| AES-256 encryption | Implemented; staging rotation pending | Versioned current-write/dual-read, encrypted notes, health reporting, and resumable rotation exist. |
| Admin layout and grave management | Implemented | Validated/audited update, deactivation/reactivation, deletion guards, reassignment, and verification reset exist. |
| Staff verification/monitoring | Implemented | Dedicated pending/missing-GPS flow supports verify/reject and failure states. |
| Client journeys | Implemented; locally verified | Search, requests, private tracking, feedback, and notifications exist; the authenticated Client journey passed. |
| Maps and directions | Application complete; infrastructure blocked | Server proxy, bounds, typed failures, overlays, and kiosk exist; approved paths and production hosts are external. |
| Reports and analytics | Implemented | Period reports plus privacy-safe operations dashboard and CSV/PDF/XLSX exports exist. |
| Broadcasts and SMTP | Implemented; mailbox smoke pending | Audience delivery, in-app rows, audit, TLS transport, retries, and bounded concurrency exist. |
| Five-year archival | Implemented; deployment pending | Durable idempotent runs and schedule exist; configure secrets and observe a real run. |
| Duplicate prevention | Implemented; locally verified | Atomic plot claim, unique `Grave.plotId`, concurrency behavior, and restrictive FK behavior passed live MySQL. |
| Web/mobile/kiosk | Implemented; locally verified | Public, kiosk, and authenticated Admin/Staff/Client Playwright journeys pass. |
| CI/release automation | Implemented; remote run unobserved | MySQL 8.4, migration, lint, Vitest, build, seed, and browser gates are configured. |
| Out-of-scope exclusions | Implemented | No image recognition, drones, blockchain, or payments were introduced. |
## Completed remediation
1. Protected mutations, owner scoping, account revocation, restrictive foreign keys, retention guards, atomic plot claims, and transactional decisions.
2. Admin location/grave controls, Staff verification, and complete Client request/feedback/notification journeys.
3. Advanced search, server-only routing, route overlays, deep links, and full-page kiosk privacy reset.
4. SMTP/broadcasts, durable archival, operations analytics/export, and encryption lifecycle tooling.
5. Hardened seed, guarded live-MySQL tests, Playwright role/public/kiosk coverage, and GitHub Actions gates.
6. Database-backed login/search throttling stores only SHA-256 bucket keys and returns bounded retry guidance.
7. Responsive repairs ensure 44px public/Leaflet targets and reachable kiosk controls.
## Verification snapshot
- Laragon `cemetery_map`: backup completed before migration; occupancy preflight was empty; **all five migrations are applied and up to date**.
- Fresh migration chain on isolated `cemetery_test`: **passed**.
- Live MySQL: **2/2 passed** (single concurrent plot claim and restrictive archived-grave map reference).
- Restore drill: backup restored to `cemetery_restore_test_20260715_113102`; verified **12 tables, 32 graves, and 44 audit logs**. The restore database remains available for inspection.
- Runtime throttling smoke: excess public search returned **429 with `Retry-After`**; failed logins remained generic; persisted identifiers were 64-character hashes only.
- Vitest: **36 files passed, 1 live-MySQL file skipped in normal mode; 147 passed, 2 skipped**.
- Playwright: public responsive **48 passed, 12 intentional skips**; kiosk routing/privacy **5 passed, 20 intentional skips**; authenticated roles **3 passed, 12 intentional skips**.
- ESLint, Next.js production build (**37 routes**), Prisma validation/status, and `git diff --check`: **passing**.
- Dependency audit: **0 vulnerabilities** after pinning `next-auth@4.24.14`, aliasing `nodemailer9` to `nodemailer@9.0.3`, and applying exact `postcss`/`uuid` overrides.
- Pre-migration backup artifact: `D:\Clients\Smart-Cemetery-backup-2026-07-15T11-31-02-596Z.sql` (**36,432 bytes**).
## Remaining release gates
1. Survey, approve, and version Bolonsori walkways; provision managed/self-hosted production tile and pedestrian-routing hosts.
2. Smoke SMTP with a dedicated mailbox; configure archival secrets and observe success, replay, overlap, and failure handling.
3. Rotate encryption only on backed-up staging data; retain prior keys until pending rows are zero and decryptability is verified.
4. Observe the configured workflow on the remote GitHub CI environment.
5. Complete and approve the broader accessibility, security, performance, deployment, and release reviews.
See `.kiro/specs/production-readiness-remediation/tasks.md` for evidence-based status.