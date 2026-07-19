# Migration deployment notes

## Fresh database

Run `npx prisma migrate deploy`. The checked-in chain contains five migrations:

1. `20260701000000_init` creates the original eleven-table schema.
2. `20260710200224_add_notifications_and_widen_grave_ciphertext` adds notifications and widens encrypted fields.
3. `20260714120000_enforce_plot_occupancy_and_retention` enforces one grave per plot and retention-safe foreign keys.
4. `20260715120000_complete_operational_workflows` adds verification, encryption metadata, broadcasts, navigation metadata, and archival runs.
5. `20260715133000_add_rate_limit_buckets` adds privacy-preserving database-backed throttle buckets.

## Existing database created with `prisma db push`

Do not run the baseline as SQL against an existing populated schema. First back up the database and verify that its tables match the baseline. Then mark only the baseline as already applied:

```powershell
npx prisma migrate resolve --applied 20260701000000_init
```

After that, inspect migration status and apply later pending migrations through the normal deployment process.

## Occupancy preflight

Before applying `20260714120000_enforce_plot_occupancy_and_retention`, run this read-only query:

```sql
SELECT plot_id, COUNT(*) AS grave_count
FROM graves
GROUP BY plot_id
HAVING COUNT(*) > 1;
```

The result must be empty. If it is not, stop and resolve the conflicting records under an approved data-retention procedure. Never delete archived records to make the migration pass.

## MySQL foreign-key statement compatibility

Keep each foreign-key drop and same-name recreation in separate `ALTER TABLE` statements. MySQL rejects dropping and recreating the same constraint name in one statement. Do not recombine the split statements in the retention or operational migrations.

## Operational workflow migration

`20260715120000_complete_operational_workflows` is additive but changes audit and notification foreign-key behavior, adds indexes, and creates broadcast/archival tables. Before production deployment:

1. Back up the database and verify restore procedures.
2. Run `npx prisma migrate status`.
3. Apply the full chain to an empty disposable database with `npm run test:mysql`.
4. Test against a production-sized restored copy because MySQL `ALTER TABLE` operations can lock large tables.
5. Apply with `npx prisma migrate deploy`; never use `db push` in production.

The migration labels existing encrypted details as key version `v1` and leaves existing notes marked as plaintext. Configure `ENCRYPTION_KEY_VERSION=v1` for the original key before deployment. Afterward, set the new current version/key, place old keys in `ENCRYPTION_KEY_PREVIOUS`, back up again, and run `npm run db:rotate-encryption` with `ROTATE_ENCRYPTION_CONFIRM=rotate`. Retain previous keys until row counts and decryptability are verified.

## Rate-limit migration

`20260715133000_add_rate_limit_buckets` stores only SHA-256 bucket keys, counts, and expiration/update timestamps. Apply it before enabling the login or public-search throttle paths. Raw email addresses and IP addresses must never be persisted in this table.

## Disposable MySQL validation

`npm run test:mysql` refuses to run unless `ALLOW_LIVE_MYSQL_TESTS=yes`, `TEST_DATABASE_URL` differs from `DATABASE_URL`, and the test database name contains `test`. It applies checked-in migrations and verifies the unique plot claim and restrictive archived-grave foreign key. It never resets or drops a database.