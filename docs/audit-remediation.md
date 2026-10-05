# Adversarial audit remediation

This release addresses the confirmed application and database findings from the full review. Changes to the database were applied through migrations; generated database references were then refreshed from the live schema.

## Changes

| Area | Remediation |
| --- | --- |
| Public rendering | Supported Next.js and React versions; public route content seeded on the server; per-route metadata, canonical links, locale language, sitemap and robots; loading no longer blanks the entire application. |
| Admin authentication | Exact origin matching; validated token expiry controls cookie lifetime; refreshed browser sessions update the server cookie; logout clears both sessions. |
| Page editing | Stable editor components, guarded asynchronous loading, separate locale drafts, retained edits during save, explicit Spanish publication, and atomic content/media bundles. |
| Content caching | Confirmed writes invalidate the shared cache; stale in-flight reads cannot replace current content; intentional empty strings remain empty. |
| Media | Validated API inputs, atomic asset/slot writes, server-authorized private previews, and signed direct uploads with size/type verification and unique paths. |
| Booking submission | Bounded input, Puerto Rico date rules, matching client/server party and time limits, durable idempotency, and transactional rate limits. |
| Booking management | Locked approval/decision updates prevent duplicate sessions; linked session details, cancellation and payments stay consistent. |
| Email | Branded English/Spanish templates, monitored Gmail destination and Reply-To, transactional notification queue, leased retries, provider idempotency, and admin-visible delivery status. |
| Finances | Refunds count as cash outflows; receipt relocation uses an expected-path update and compensates failed copies. |
| Database access | Private admin RPC access removed from anonymous users; guarded authenticated RPCs; pinned search paths; unnecessary table privileges removed; foreign-key indexes added. |
| Database query safety | Duplicate indexes removed, missing self-reference index added, media policy JWT evaluation hoisted, private media metadata restricted to public assets, redundant admin read policy removed. |
| Reproducibility | Real schema-only dump and exact policy catalog, hash-linked generated references, current Supabase baseline, regression scripts, and CI checks. |

## Verified database behavior

The database regression suite ran against the linked Supabase project inside a transaction and rolled its fixtures back. It checked content/media rollback, intentional empty English and published Spanish values, draft publication boundaries, booking replay/conflict, notification leases/retries/payload scrubbing, repeated approval, booking/session synchronization, cancellation, payments, and anonymous access denial.

Two independent concurrent approvals produced one successful approval, one rejected repeat, and exactly one session. The temporary booking and session were removed afterward.

`npm run fulldb` completed successfully. The capture contains 12 application tables with RLS enabled, 64 PostgreSQL functions, 58 generated RPC names, and 24 exact policies. The baseline and function reference contain schema definitions and grants, with no table data or vault secret values. All eight local migration versions match the linked production database.

## Release verification

`npm run verify` completed successfully on 2026-10-05: lint and type checking passed, all 60 application regression tests passed, the Next.js 16 production build completed, and server-rendered HTML checks passed for all 18 English/Spanish public routes plus `robots.txt` and the sitemap. Lint reported warnings but no errors. The live Supabase rollback regression suite passed after the final migrations. `npm audit --omit=dev` reports zero production dependency vulnerabilities. The full development dependency audit still reports five high advisories through `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`; npm offers only a major downgrade to the incompatible Next 14 lint config, and no patched `braces` release is published on the configured registry.

## Remaining verification and operational limits

- Fresh baseline restoration requires an isolated Supabase instance and its managed roles, schemas and extensions. Live extraction and generation passed; fresh restoration has not been verified because the local Docker daemon is unavailable.
- Supabase Auth still reports account-level leaked-password protection and MFA advisories. Enrolling an authenticator requires the account holder's device; this release does not force enrollment or change paid account settings.
- The Supabase advisors still list 19 unused indexes and overlapping permissive policies. The unused indexes are retained pending workload evidence; removing them would risk slowing real admin queries. The two RLS-without-policy tables are private service-only booking tables, and the reported security-definer RPCs are the explicitly reviewed public content/media operations and admin-guarded functions.
- SMS needs a configured sending provider and credentials. No SMS provider is configured, so this release does not claim text-message delivery.
- The signed-in Chrome profile was not exposed to the current browser automation session, so an authenticated admin click-through remains unverified. Public route rendering was checked in an isolated local browser/server process; it did not alter the user's Chrome profile.

The generated baseline excludes lesson/content seed records, authentication users, admin allowlist entries, storage configuration/files, vault values, and cron registrations. Its bootstrap guide describes provisioning and the migration-history boundary separately.
