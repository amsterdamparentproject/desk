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

### Triage tab: Desk table

The Triage tab is a single sortable table (`app/components/DeskTable.tsx`, logic in `lib/desk-table.ts`), not kanban columns. It shows every "held" row (`list_id` in ideas / capture / review / error / refine; the database lists are unchanged, only the UI merges them). Capture is one bar at the top; rows sort by Added, Date (resources always last) or Title. Refinement happens in the table: the "Use for" column toggles Newsletter / Post, and "Done refining" (shown only once at least one service is selected) moves the row to `upcoming_events` / `new_resources` with status `accepted`. Newsletter and Post tabs therefore only hold refined items; `isPostEligible` excludes held rows. The Date column shows the next occurrence for recurring events (`effectiveStart` recomputes it when the stored `repeat_next_date` is missing or stale). The Newsletter tab uses the same component in `mode="newsletter"`: rows are refined items tagged Newsletter (`upcoming_events` / `new_resources` / `next_newsletter`), rows in `next_newsletter` are highlighted with a "Next issue" badge, and the row action "Add to next" / "Remove" moves them in and out (`handleMoveList` in Board). The Post tab is not yet a table.

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

### Parse callback & resilience (`app/api/desk/callback/route.ts`, `lib/parse/`)

n8n posts AI results to the callback. It resolves the record's real table by id (never trusting the AI's `type`), validates output with Zod (`lib/parse/schema.ts` — the AI may only set content fields; `file_url`/`list_id`/`status`/`services` are ignored), and records `parse_error` / `parse_warnings` / `parse_raw` on the card (migration `015`; writes degrade gracefully if it hasn't been run). Failure payloads (`{ id, failed: true, error }`) move the card to Errors with a reason. Extra events the AI splits out get deterministic ids (`childActivityId`) so retries don't duplicate, and inherit the parent's `file_url`. `POST /api/cron/sweep-stuck` (n8n secret header) moves cards stuck in `processing` to Errors. See `__claude__/n8n-parse-resilience.md` for the matching n8n changes.

### Recurrence (`app/utils/rrule.ts`)

Custom RRULE parser/builder — no external library. Supported frequencies: `daily`, `weekly`, `biweekly` (`FREQ=WEEKLY;INTERVAL=2`), `monthly` (positional weekday only, e.g. `BYDAY=1MO`). `computeNextDate` calculates the next occurrence from `start_date` and is called server-side in `saveActivity` to persist `repeat_next_date`.

### Auth

Single shared-password login, not per-user accounts, and no Supabase Auth involved — the admin client bypasses RLS entirely.

- `/login` (`app/login/page.tsx`) renders a password form that posts to `POST /api/login` (a route handler, not a Server Action: `proxy.ts` 401s any Server Action without a valid session, so a login action could never work for a signed-out user).
- `/api/login` compares the submitted password to `DESK_PASSWORD` and, on success, sets the `app_desk_session` cookie to that same secret value with `maxAge` = 10 years (`COOKIE_MAX_AGE` in `app/utils/auth-gate.ts`) — sessions are meant to rarely expire.
- `verifyDeskSession` (`app/utils/auth-gate.ts`) just checks that cookie value against `DESK_PASSWORD`; every protected page/layout (`app/page.tsx`, `app/finances/layout.tsx`, `app/customers/layout.tsx`, `app/sources/page.tsx`, `app/share/page.tsx`) calls it directly and `redirect('/login')`s if it fails. Page loads have no centralized gate; Server Actions do (see `proxy.ts` below).
- `logout` (`app/actions/auth.ts`) clears the cookie and redirects to `/login`; wired up as a "Log out" button in `DeskNav`.
- `proxy.ts` (Next 16's replacement for `middleware.ts`) gates Server Actions: any POST carrying a `next-action` header gets a 401 unless the `app_desk_session` cookie matches `DESK_PASSWORD`. Without it, only page loads would be protected, since Server Actions are independently invocable POST endpoints. API routes (no `next-action` header) do their own auth (`verifyDeskSession` or the n8n webhook secret). The old `?token=` magic-link flow is gone, replaced by the login page.

### Database schema source files

`lib/supabase/` contains the canonical schema definitions and migrations. Schema changes go in `lib/supabase/migrations/` as `YYYYMMDD_description.sql` files and are run manually in the Supabase SQL editor. Update the relevant `.sql` definition file alongside any migration.

## Environment variables

| Variable                        | Purpose                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Admin key (server only)                                                                        |
| `DESK_HMAC_KEY`                 | Key for HMAC-signed Desk<->n8n requests (`lib/auth/`); same value as the n8n Crypto credential |
| `N8N_DESK_WEBHOOK_URL`          | Production n8n webhook                                                                         |
| `TEST_N8N_DESK_WEBHOOK_URL`     | Dev/test n8n webhook (workflow must be listening)                                              |
| `DESK_PASSWORD`                 | Shared login password; also the value stored in the `app_desk_session` cookie                  |
