# Deployment Runbook — Smart Cemetery

Operational guide for deploying the Smart Cemetery Navigation and Monitoring
Platform to a staging or production environment. Application code is
release-ready; the steps below cover the infrastructure, configuration, and
verification gates that must be completed by an operator.

> All commands assume Node.js 22+, npm, and a reachable MySQL 8.x instance.
> Every environment variable referenced here is documented in `.env.example`.

---

## 1. Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js 22+ and npm | Matches the CI runner (`.github/workflows/ci.yml`). |
| MySQL 8.x | Dedicated database for the environment; never share with tests. |
| Google Maps API key | Restricted by HTTP referrer (web) and API. |
| Pedestrian routing host | Managed or self-hosted; public OSRM is dev-only. |
| SMTP mailbox | Optional; notifications fall back to in-app only when unset. |
| HTTPS host | Reverse proxy or platform TLS terminating in front of the app. |

---

## 2. Configure environment

1. Copy the template and fill in real values:
   ```bash
   cp .env.example .env.local
   ```
2. Generate strong secrets (do not reuse the placeholders):
   - `NEXTAUTH_SECRET` — 32+ random characters.
   - `ENCRYPTION_KEY` — 32-byte (64 hex char) key; keep `ENCRYPTION_KEY_VERSION` at `v1` for a first deploy.
   - `ARCHIVAL_CRON_SECRET` — random token shared with the scheduled workflow.
3. Set the deployment URL and map/routing hosts:
   - `NEXTAUTH_URL` — the public HTTPS origin.
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `ROUTING_BASE_URL`, `ROUTING_PROFILE`.
4. Optional email: set all `SMTP_*` values and `EMAIL_FROM`, keeping TLS checks enabled.

Never commit real secrets. `.env` and `.env.local` are git-ignored; only `.env.example` is tracked.

---

## 3. Database setup

First deploy (creates schema, generates client, seeds baseline data):
```bash
npm ci
npm run db:setup
```

Subsequent deploys (schema changes only):
```bash
npm ci
npm run db:migrate
npm run db:generate
```

Seed credentials come from the `SEED_*` variables (minimum 12 characters) and are
required by `npm run db:seed`. Rotate them out of any shared environment after the
first login.

---

## 4. Build and run

```bash
npm run build
npm run start   # serves the production build
```

Behind a process manager or container, run `npm run start` after a successful
`npm run build`. Terminate TLS at the proxy/platform layer and forward to the app port.

> Security note: the app enforces authentication in the proxy guard and
> re-checks role and account state in every API handler. Do not disable either
> layer. Public endpoints are limited to `/`, `/login`, `/search`, `/kiosk`, and
> the read-only public APIs.

---

## 5. Scheduled archival (five-year retention)

`.github/workflows/scheduled-archival.yml` calls `POST /api/archival` daily at
00:15 UTC. Configure two GitHub repository secrets:

| Secret | Value |
| --- | --- |
| `ARCHIVAL_URL` | Public origin of the deployed app (no trailing slash). |
| `ARCHIVAL_CRON_SECRET` | Must equal the app's `ARCHIVAL_CRON_SECRET` env value. |

The endpoint authenticates on the `x-archival-token` header and de-duplicates on
`x-archival-run-key` (defaults to `daily:YYYY-MM-DD`). Duplicate keys return the
prior run; overlapping runs return HTTP 409. Optionally set
`ARCHIVAL_SYSTEM_USER_ID` so cron runs attribute their audit entry to a user.

Trigger a manual run from the Actions tab (`workflow_dispatch`) to validate the
wiring before relying on the schedule.

---

## 6. Encryption key rotation

Rotate only on backed-up data:

1. Back up the database.
2. Add a new key, increment `ENCRYPTION_KEY_VERSION`, and keep the prior key in
   `ENCRYPTION_KEY_PREVIOUS` (JSON keyring) so existing rows stay decryptable.
3. Run the resumable rotation with the required confirmation:
   ```bash
   ROTATE_ENCRYPTION_CONFIRM=rotate npm run db:rotate-encryption
   ```
4. Retain prior keys until the encryption health report shows zero pending rows
   and decryptability is verified (`GET /api/encryption/health`, Admin only).

---

## 7. Pre-release verification gates

Run the full local release gate before promoting a build:
```bash
npm run test:release   # lint + unit/integration tests + production build
```

Live-MySQL and end-to-end suites run in CI on every push/PR against a disposable
MySQL 8.4 service. Confirm the workflow is green on the target commit before
release.

Operational gates that require real infrastructure or human sign-off:

- [ ] Bolonsori walkways surveyed, approved, and versioned; production tile and pedestrian-routing hosts provisioned.
- [ ] SMTP smoke test with a dedicated mailbox.
- [ ] Scheduled archival observed end-to-end (success, duplicate replay, overlap 409, failure handling).
- [ ] Encryption rotation rehearsed on backed-up staging data.
- [ ] CI workflow observed green on GitHub's runners.
- [ ] Accessibility, security, performance, and deployment reviews completed and approved.

---

## 8. Post-deploy smoke checklist

- [ ] Sign in as Admin, Staff, and Client; confirm each lands on its own dashboard.
- [ ] Public search returns results and opens the map with directions.
- [ ] Create/edit a grave and plot; verify a plot; submit and track a request by reference ID.
- [ ] Direct-navigate to an Admin-only route as a Client and confirm redirect to the dashboard home.
- [ ] Confirm light/dark theme persists across reload and honors the OS preference.
- [ ] Trigger the archival workflow manually and confirm a `success` run is recorded.

---

## 9. Rollback

1. Redeploy the previous known-good build/image.
2. Only restore the database from backup if a migration must be reverted; app
   code is backward-compatible within a release line.
3. Encryption: never remove a key version until its rows are re-encrypted to a
   newer version, or previously encrypted data becomes unreadable.
