# Migration deployment notes

## Fresh database

Run `npx prisma migrate deploy`. The `20260701000000_init` migration creates the original eleven-table schema; later migrations add notifications/encrypted column widths and enforce retention-safe occupancy.

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