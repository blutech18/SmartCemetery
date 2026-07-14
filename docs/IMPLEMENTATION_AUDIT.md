# Smart Cemetery Implementation Audit

**Audit date:** 2026-07-14
**Source of truth:** `docs/Smart_Cemetery.md`
**Method:** Static review of application code, Prisma schema/migrations, tests, and configuration. Generated output, dependencies, assets, lockfiles, and secret values were excluded.

## Executive assessment

The platform is **partially complete, not production-ready, and not fully conformant** with the system specification. Core API, data, authentication, encryption, archival, report-generation, and Leaflet foundations exist. The main weaknesses are incomplete role journeys, authorization/data-retention vulnerabilities, unfinished production tile/pedestrian-routing infrastructure, missing operational automation, and limited real-infrastructure/browser validation.

## Coverage matrix

| Capability | Status | Evidence / remaining gap |
|---|---|---|
| Next.js UI + Next API architecture | Implemented | App Router pages and `src/app/api/**` route handlers exist. |
| MySQL relational model and 11 specified entities | Partial | Models exist in `prisma/schema.prisma`, plus Notification; checked-in migrations lack a clean baseline. |
| Authentication and RBAC | Partial | JWT guards and permission matrix exist; Location POST and Navigation APIs are insufficiently protected, page roles are not enforced consistently, and request lookup lacks ownership checks. |
| AES-256 sensitive-field encryption | Partial | AES-256-GCM protects contact/cause fields; plaintext migration, key rotation/versioning, and free-form note classification are absent. |
| Admin layout management | Partial | Plot CRUD exists; Location update/delete and consistent auth/audit are missing. |
| Admin grave management | Partial | Create/list/search exist; grave update/delete are missing and archived-record retention is not enforced against cascades. |
| Admin reports | Partial | Stats and real PDF/XLSX generation exist; UI export controls and audit/navigation-log reports are missing. |
| Admin request approval | Implemented | Admin status decisions, in-app outcomes, and audit writes are present. |
| Admin broadcasts | Missing | No broadcast model, endpoint, composer, or delivery workflow exists. |
| Staff verification/monitoring | Partial | Incomplete-record endpoint and plot views exist; no verification state/action, GPS completeness alert, or dedicated Staff workflow exists. |
| Client search | Partial | Name and phonetic fallback exist; grave-ID, year, and nearby-section search are absent. |
| Client map/directions | Partial | Leaflet is now the approved renderer; production-safe tiles, cemetery-specific pedestrian routing, and connected public/kiosk journeys remain to be completed. |
| Client request submission/tracking | Partial | APIs exist; no submission form, tracking UI stores an object as an array, and lookup can expose another user's request by known reference. |
| Client feedback | Partial | POST API exists; the Client page calls the Admin list endpoint and has no submission form. |
| Notifications | Partial | Request outcome rows exist; no inbox/read UI, real SMTP transport, or broadcast support exists. |
| Five-year archival | Partial | Correct reclassification logic and endpoint exist; no deployed scheduler and plot cascades can delete archived graves. |
| Duplicate/double-booking prevention | Partial | Similar-record checks and plot status checks exist; confirmation bypass, no one-grave-per-plot constraint, and a concurrency race remain. |
| Incomplete-record alerts | Partial | API reports missing name/date/plot; it does not evaluate plot GPS or deliver Staff alerts. |
| Smart monitoring and usage analytics | Partial | Operational counts/log rows exist; no real-time mechanism or navigation/audit usage dashboard/export exists. |
| Web/mobile/kiosk | Partial | Public responsive tests exist; kiosk lacks map/routing and authenticated role journeys are not covered. |
| Out-of-scope exclusions | Implemented | No image recognition, drones, blockchain, or payment gateway found. |

## Remediation progress

Completed in the first build increment:

1. **Security:** Location creation is Admin-only and audited; Navigation writes use session identity; Navigation logs are Admin-only; Client request reads are owner-scoped.
2. **Retention:** Layout foreign keys now use restrictive deletion, plot deletion rejects attached/archived graves, and archived map references cannot be removed through Plot cascades.
3. **Integrity:** Grave creation claims a plot atomically and the database enforces one grave per plot. Request decisions and required in-app notifications now commit atomically.
4. **Client journeys:** Request submission/private tracking, role-correct feedback, and an owner-scoped notification inbox/read flow are implemented.
5. **Mapping:** Leaflet is approved; production now requires configured tile and pedestrian-routing endpoints, while public providers are development-only fallbacks.
6. **Deployability:** A baseline migration and existing-database baselining/preflight instructions are checked in.

## Remaining priorities

- Configure production tile hosting and build/import the cemetery walkable-path routing dataset.
- Implement Staff verification/missing-GPS workflow, Admin grave/location updates, broadcasts, real SMTP, archival scheduling, analytics, and key rotation.
- Add live-MySQL migration/concurrency coverage and full Admin/Staff/Client/kiosk Playwright journeys.

## Verification snapshot

- Automated suite: **22 files / 101 tests passing**.
- ESLint: **clean**.
- Next.js production build: **passing**, including the new `/dashboard/notifications` page.
- Prisma schema validation and Client generation: **passing**.
- The new migrations were not applied to a live database; target data must pass the documented duplicate-plot preflight first.

See `.kiro/specs/production-readiness-remediation/` for remaining phased tasks.