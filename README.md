# Jazmine Dean Surf School

A bilingual (EN/ES) surf lesson booking site built with Next.js App Router, TypeScript, and MUI.

Content (pages + media) is managed via Supabase (Postgres + Storage). Booking is **request-based**: the public site submits booking requests to the database, and the admin dashboard approves/denies requests and manages sessions/billing.

## Tech
- Next.js (App Router) + TypeScript + MUI
- i18n via `next-intl` with `/en` and `/es` locales
- Supabase: Auth, Postgres, Storage
- TipTap (admin rich-text editing)
- Deploy on Vercel

## What works today (functional audit)

### Public site
- Static marketing pages with CMS-backed strings via `GET /api/content-bundle`
- Booking request submission via `POST /api/booking-requests` (stores `booking_requests` rows, including `bill_total_cents` quote)

### Admin dashboard
- Login: `/{locale}/adminlogin` → cookie-based admin session (`admin_at`)
- Requests & Billing: review/edit booking requests, approve/deny, track billing fields (Total/Paid/Due)
- Sessions: create/edit sessions, soft-delete/restore, month calendar view
- Finances: charts and aggregates from sessions (revenue/tips) + receipts (expenses)
- Media: upload and manage assets + stable slot keys

### What is still stubbed / not wired
- Availability: `GET /api/availability` returns `{ slots: [] }`
- “Bookings create” pipeline: `POST /api/bookings/create` returns `501`
- SMS alerts are not configured; the booking email flow uses Resend
- Stripe: webhook route is not implemented (folder exists, no handler)

## Local setup

### 1) Install dependencies

```cmd
npm install
```

### 2) Configure environment

Create `.env.local` in the project root:

```bash
# Public (browser) Supabase client
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-side admin routes (DO NOT expose this to the browser)
SUPABASE_SERVICE_ROLE_KEY=

# Booking request emails (server-side only; sender domain must be verified in Resend)
RESEND_API_KEY=

# Optional: used by `npm run typegen` / `npm run snapshot`
SUPABASE_PROJECT_REF=
# or
DATABASE_URL=

# Optional: translation provider for admin tooling
# TRANSLATE_PROVIDER=deepl|libretranslate
DEEPL_API_KEY=
DEEPL_API_URL=
LIBRETRANSLATE_URL=
LIBRETRANSLATE_API_KEY=

# Optional: Stripe (not currently wired into a live checkout flow)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is required for admin API routes under `app/api/admin/*`.
- `SUPABASE_PROJECT_REF` can be derived automatically from `NEXT_PUBLIC_SUPABASE_URL`, but you can set it explicitly.
- The app includes a health check at `GET /api/health` that reports whether the expected env vars are present (it does not return secret values).

### 3) Run dev server

```cmd
npm run dev
```

## Booking flow (request-based)

1) Public user submits a request (no checkout): `POST /api/booking-requests`
2) After the request is saved, the server sends an admin alert to `sunsetsurfacademy@gmail.com` and a request receipt to the customer. Both use `bookings@sunsetsurfacademy.com` as sender and set Reply-To to the monitored Gmail inbox. If Resend is unavailable, the request remains saved and the booking page shows an email warning.
3) Admin reviews the request in `/{locale}/admin` → “Requests & Billing”
4) Approving a request creates a `sessions` row (via Supabase RPC) and links it back to the request

Notes:
- The booking UI loads active lesson types from `GET /api/lesson-types`.
- Availability is currently not enforced (availability API is stubbed).

## CMS + admin

### Admin login
- Login page: `/adminlogin` (not linked from the public nav)
- Admin dashboard: `/admin`

How it works:
- The login UI authenticates with Supabase Auth and receives an access token.
- `POST /api/admin/login` accepts `{ "access_token": "..." }`, validates it server-side, verifies the user exists in `admin_users`, then sets an httpOnly cookie `admin_at` (1 hour).
- Admin API routes use that cookie to validate the user on each request.

Admin helpers/endpoints:
- `GET /api/admin/status` returns `{ ok: true, isAdmin }` based on the current cookie.
- `GET /api/admin/logout` clears admin cookies and redirects to `/{locale}/adminlogin`.

Security note:
- For non-GET admin requests, admin APIs enforce a same-origin check (via `Origin`/`Referer`) in addition to the cookie.

## Sessions & time handling

`sessions.session_time` is treated as a local “wall-clock” timestamp string (Postgres `timestamp without time zone`).

Practical implication:
- The code avoids `Date(...)` for formatting/parsing session times when possible, to prevent timezone shifts.

## Billing fields (booking requests)

`booking_requests` tracks:
- `bill_total_cents` (nullable)
- `amount_paid_cents` (integer)
- `balance_cents` (Due)

Important:
- In the current schema snapshot, `balance_cents` is a GENERATED column.
- Do not write `balance_cents` from API code; write `bill_total_cents` / `amount_paid_cents` and let Postgres compute Due.

Admin RPCs:
- `admin_update_booking_request_billing(p_id, p_bill_total_cents, p_amount_paid_cents)`
- `admin_apply_booking_request_payment(p_id, p_delta_cents)`

### CMS content
- Public pages fetch content from Supabase via RPCs (example: `get_page_content`).
- Admin editing is available in the admin dashboard.

Admin CMS API:
- `GET /api/admin/cms/page-content?page_key=...` fetches a single CMS row.
- `GET /api/admin/cms/page-content?category=...&page_key_like=section.%25...` lists section-meta rows for admin tools (bounded + prefix-guarded).
- `POST /api/admin/cms/page-content` supports ops: `save`, `publish_es`, `delete`, `create_section`.

Public content bundle:
- `GET /api/content-bundle?locale=en|es&prefix=...` returns a combined payload of CMS strings and public media for a prefix (used to batch-fetch content for pages/sections).

## Media system

### Storage buckets
- `Lesson_Photos` (public)
- `Private_Photos` (private)

### Database
Media metadata lives in `public.media_assets` (includes `bucket`, `path`, `title`, `category`, `asset_type`, `public`, and `sort`).

Stable frontend pointers live in `public.media_slots` as `slot_key -> asset_id`.

### Stable pointer system (`slot_key`)
- Use `slot_key` as a stable frontend pointer (e.g. `home.hero`).
- Use a prefix namespace for streams/galleries (e.g. `home.photo_stream.001`, `home.photo_stream.002`, …).
- Public lookup RPCs:
	- `get_public_media_asset_by_key(p_slot_key)`
	- `get_public_media_assets_by_prefix(p_prefix)` (ordered by `sort`)

### Admin media endpoints
- `GET /api/admin/media/assets` — list `media_assets`
- `POST /api/admin/media/assets` — upsert metadata (optionally assigns a `slot_key` via the `asset_key` field)
- `GET /api/admin/media/slots?prefix=...` — list slot bindings (and joined asset data) by prefix
- `POST /api/admin/media/slots` — set a single slot or replace the `gallery.images.*` set
- `POST /api/admin/media/upload` — upload file(s) + insert rows
- `POST /api/admin/media/signed-url` — generate signed URLs (including for `Private_Photos`)

### Upload rules
- Filename collisions are handled automatically: `name.ext`, `name(1).ext`, `name(2).ext`, …
- Bulk uploads derive titles from the uploaded filename plus an id.
- Optional pointer assignment:
	- Single upload: set `asset_key` (stored as `media_slots.slot_key`)
	- Bulk upload: set `asset_key_prefix` to auto-generate `prefix.001`, `prefix.002`, … (stored as `media_slots.slot_key`)

Notes:
- Upload API restricts buckets to `Lesson_Photos` and `Private_Photos`.
- Gallery slot keys under `gallery.images.*` are canonicalized (e.g. `gallery.images.007` becomes `gallery.images.7`).

## Useful scripts

```cmd
npm run lint
npm run build

REM Regenerate Supabase types into lib/database.types.ts
npm run typegen

REM Regenerate backend.snapshot.md (+ backend.snapshot.sql if possible)
npm run snapshot

REM Convenience: typegen + snapshot
npm run fulldb
```

## Database workflow notes

- Migrations live in `supabase/migrations/`.
- Type generation writes to `lib/database.types.ts`.
- Backend snapshots write to `backend.snapshot.md` (and `backend.snapshot.sql` when possible).

## Deployment (Vercel)
- Set environment variables from the `.env.local` list above.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser (server-only).

## Notes
- Backend reference snapshots live at `backend.snapshot.md` / `backend.snapshot.sql`.
- Storage/media is admin-controlled: public users only see what pages/components reference.
