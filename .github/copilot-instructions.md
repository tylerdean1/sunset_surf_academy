# Copilot instructions — Jazzy Surf School

## Shorthand / workflow meanings

- **“I ran fulldb”** means: `npm run fulldb`.
  - This refreshes types, a real schema-only snapshot, RPC/edge references, policies, table RPC mappings and function SQL.
  - Treat this as having already refreshed both the generated Supabase types and the backend snapshot artifacts.

- `npm run typegen` regenerates Supabase types into `lib/database.types.ts`.
- `npm run snapshot` regenerates backend reference snapshots into:
  - `backend.snapshot.md`
  - `backend.snapshot.sql` (required for a successful snapshot)
  - `backend.snapshot.catalog.json`
  - `supabase/baseline.sql` and `supabase/baseline.metadata.json`

## Generated backend artifacts (never edit)

These files are generated outputs. **Do not manually edit them** under any circumstance:

- `lib/database.types.ts`
- `backend.snapshot.md`
- `backend.snapshot.sql`
- `backend.snapshot.catalog.json`
- `supabase/baseline.sql`
- `supabase/baseline.metadata.json`
- `lib/database.policies.ts`
- `lib/functions.sql`

Allowed use:
- Read/inspect these files to understand the current backend structure, schema, RPCs, and to verify whether the backend changed.

If changes are needed:
- Make backend/schema changes via Supabase migrations in `supabase/migrations/` and/or the appropriate backend SQL sources.
- Then regenerate via `npm run fulldb` (or ask the user to run it).
- Do not “fix” the generated outputs directly.

## Repo-specific backend notes

- Migrations live in `supabase/migrations/`.
- Data writes are **RPC-only**; do not write directly to tables from app code.
- If a frontend change requires backend/schema/RPC changes, create a new migration in `supabase/migrations/` (then regenerate via `npm run fulldb` when appropriate).

## Collaboration expectations

- If the user says they already ran `fulldb`, do not request they run it again unless a later change would require regeneration.
- Keep edits focused; avoid unrelated refactors.
