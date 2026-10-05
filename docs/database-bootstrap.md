# Database schema generation and bootstrap

`npm run fulldb` refreshes the generated types, captures the live application schema, and regenerates the RPC, policy and function references. It must finish successfully before those outputs can be described as current. A failed dump leaves the previous generated files in place and exits with an error.

The snapshot uses `pg_dump --schema-only --no-owner`. It retains table definitions, functions, enum types, indexes, constraints, row security, policies and grants. It does not include table records, authentication users, vault secrets, storage objects or migration history.

## Generate the current schema

Use Node 20.12 or later and PostgreSQL client tools (`pg_dump` and `psql`) compatible with the database server version. The Supabase CLI must be installed and authenticated when using a linked project. The generator does not require Docker and does not install tools automatically.

Use either a secret database connection configured through `DATABASE_URL`/`SUPABASE_DB_URL`, or the existing project link established by `supabase link`. In the linked case, the generator checks that the link matches the application's Supabase project, captures the CLI's connection exports in memory, and passes them to PostgreSQL tools as environment variables. It does not evaluate the shell script or print connection credentials.

```powershell
npm run fulldb
```

For a snapshot without regenerating the other references:

```powershell
npm run snapshot
```

`--reuse-types` is reserved for a workflow that has just completed type generation. The full generation pipeline uses it to avoid generating the same types twice.

The default application schema is `public`. Additional application schemas can be selected with `SUPABASE_SNAPSHOT_SCHEMA=public,private` or `npm run snapshot -- --schema public,private`. Supabase-managed `auth`, `storage`, `vault` and migration history schemas are excluded from application baselines. Type generation can still include `auth` through its existing `SUPABASE_TYPEGEN_SCHEMA` setting.

The generator writes:

| Output | Purpose |
| --- | --- |
| `lib/database.types.ts` | Supabase-generated application types |
| `backend.snapshot.sql` | Local schema-only dump; ignored by Git |
| `backend.snapshot.catalog.json` | Local policy and extension catalog; hash-linked to the SQL dump |
| `backend.snapshot.md` | Local human-readable snapshot and generated types |
| `supabase/baseline.sql` | Generated schema baseline for a fresh Supabase database |
| `supabase/baseline.metadata.json` | Baseline capture time, server version, schema hash, policies and extension requirements |
| `lib/database.policies.ts` | Exact database policy catalog, including roles and `WITH CHECK` |
| `lib/functions.sql` | Schema/function reference derived from the same verified dump |

These outputs are generated. Make schema changes through migrations, then run the generator; do not edit the outputs by hand. Policy and function generation verify that the catalog hash matches the SQL snapshot, so mismatched or partially written captures cannot silently replace their outputs.

## Bootstrap a fresh Supabase database

The baseline captures the current schema after the existing project's migrations. The historical migration files are incremental changes to a database that already existed. They are not a complete initial creation chain.

Use a fresh, isolated Supabase database with its standard roles (`anon`, `authenticated`, `service_role`, and database administration roles), managed authentication/storage schemas, and the PostgreSQL extensions listed in `supabase/baseline.metadata.json`. The baseline creates those extensions when available. Extensions such as `pg_cron` and `pg_net` also require the platform's normal extension support and configuration. A plain PostgreSQL database without Supabase's managed components is insufficient.

Before restoration, point the PostgreSQL connection environment variables at the fresh target and verify that it has no existing application tables. Apply the baseline once with error checking and a single transaction:

```powershell
psql --no-psqlrc --set=ON_ERROR_STOP=1 --single-transaction --file=supabase/baseline.sql
```

The baseline tolerates an existing empty `public` schema and does not drop an existing application schema. A conflicting object causes restoration to fail.

Do not replay the historical migrations after restoring the baseline. First compare the baseline's capture with the source project's migration history and establish the corresponding applied-history boundary through the standard Supabase migration workflow. New migrations written after that boundary are then applied normally. Never reset or repair the production project's history as part of a bootstrap experiment.

Schema restoration does not restore lesson types, published CMS content, admin allowlist entries, customer records, storage buckets/files, vault configuration, or background job registrations. Provision the required configuration and reviewed seed data separately, without copying customer data or secrets into source control.

Successful live generation proves that the current schema can be extracted and its references reproduced. It does not prove fresh restoration: that requires an actual isolated Supabase instance, successful baseline application, and application smoke checks. Report those checks separately.
