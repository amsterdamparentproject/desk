# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
yarn dev          # start dev server
yarn build        # production build
yarn test         # run all tests (vitest)
yarn lint         # eslint

# Run a single test file
npx vitest run test/activities.test.ts

# Run tests matching a name pattern
npx vitest run --reporter=verbose -t "creates event"
```

## Architecture

**Desk** is a single-page internal triage tool for managing newsletter content (events + resources). The core loop: capture raw input → AI enrichment via n8n → human triage → publish to newsletter.

### Data model

Two Supabase tables in the `activities` schema: `events` and `resources`. Both share a `DeskActivity` union type (`app/types/activity.ts`). The `type` discriminator (`'event' | 'resource'`) is added client-side — it is not stored in the DB.

Key status lifecycle: `new` → `processing` (AI in-flight) → `processed` → `edited` → archived. The `list_id` field (type `ListId`) drives which kanban column the card appears in.

### Page → Board → Column → Card

`app/page.tsx` is a server component that verifies the `app_desk_session` cookie (checked against `DESK_PASSWORD` env var, see Auth below), fetches all activities from Supabase using the admin client, and passes them to `<Board>` as `initialActivities`.

`Board.tsx` owns all client state (`activities`, `selectedActivity`) and all mutation handlers. It passes callbacks down to `Column` and renders `ActivityDrawer` as a slide-over when `selectedActivity` is set.

### Server actions (`app/actions/activities.ts`)

All DB writes go through server actions using `createAdminClient()` (service role key, `activities` schema). The key detail: `saveActivity` is the general-purpose update — it picks only the allowed fields per type (`EVENT_FIELDS` / `RESOURCE_FIELDS`), coerces empty strings to `null` for non-text columns, and recomputes `repeat_next_date` from the RRULE.

### n8n webhook integration (`lib/PostToWebhook.tsx`)

`postDesk()` is a server action that POSTs to an n8n webhook. In `NODE_ENV === 'development'` it uses `TEST_N8N_DESK_WEBHOOK_URL` (requires the workflow to be open and listening in n8n); in production it uses `N8N_DESK_WEBHOOK_URL`. Auth is via `X-N8N-WEBHOOK-SECRET` header.

The AI capture flow in `Board.handleAddEvent`:
1. Create optimistic card (status: `processing`) + 2-min timeout fallback to `error`
2. Upload file to Supabase storage if present
3. Seed DB record via `createActivity`
4. POST to n8n; await enriched data back
5. Update card + persist via `saveActivity`

If the webhook call times out or fails, the card moves to the `error` list.

### Recurrence (`app/utils/rrule.ts`)

Custom RRULE parser/builder — no external library. Supported frequencies: `daily`, `weekly`, `biweekly` (`FREQ=WEEKLY;INTERVAL=2`), `monthly` (positional weekday only, e.g. `BYDAY=1MO`). `computeNextDate` calculates the next occurrence from `start_date` and is called server-side in `saveActivity` to persist `repeat_next_date`.

### Auth

Single shared-password login, not per-user accounts, and no Supabase Auth involved — the admin client bypasses RLS entirely.

- `/login` (`app/login/page.tsx`) renders a password form that posts to the `login` server action (`app/actions/auth.ts`).
- `login` compares the submitted password to `DESK_PASSWORD` and, on success, sets the `app_desk_session` cookie to that same secret value with `maxAge` = 10 years (`COOKIE_MAX_AGE` in `app/utils/auth-gate.ts`) — sessions are meant to rarely expire.
- `verifyDeskSession` (`app/utils/auth-gate.ts`) just checks that cookie value against `DESK_PASSWORD`; every protected page/layout (`app/page.tsx`, `app/finances/layout.tsx`, `app/customers/layout.tsx`, `app/sources/page.tsx`, `app/share/page.tsx`) calls it directly and `redirect('/login')`s if it fails — there's no centralized auth middleware.
- `logout` (`app/actions/auth.ts`) clears the cookie and redirects to `/login`; wired up as a "Log out" button in `DeskNav`.
- There is no `proxy.ts`/middleware anymore. It used to implement a `?token=` magic-link flow (strip the token from the URL, set the cookie) — that's been replaced entirely by the login page.

### Database schema source files

`lib/supabase/` contains the canonical schema definitions and migrations. Schema changes go in `lib/supabase/migrations/` as `YYYYMMDD_description.sql` files and are run manually in the Supabase SQL editor. Update the relevant `.sql` definition file alongside any migration.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (server only) |
| `N8N_WEBHOOK_SECRET` | Shared secret for `X-N8N-WEBHOOK-SECRET` header |
| `N8N_DESK_WEBHOOK_URL` | Production n8n webhook |
| `TEST_N8N_DESK_WEBHOOK_URL` | Dev/test n8n webhook (workflow must be listening) |
| `DESK_PASSWORD` | Shared login password; also the value stored in the `app_desk_session` cookie |
