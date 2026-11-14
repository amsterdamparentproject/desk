-- Stage/status refactor, step 1 of 2: additive schema only. Nothing reads or
-- writes these yet, so it is safe to run before the Desk deploy.
-- See __claude__/list-refactor-plan.md.
--
-- list_id becomes stage-only: inbox -> refined -> done.
-- status becomes health-only: adds 'failed' (replaces the 'error' list).
-- in_next_issue replaces the 'next_newsletter' list.
--
-- Run the ALTER TYPE statements OUTSIDE a transaction block (the Supabase SQL
-- editor does this by default), and run them before 017.
ALTER TYPE activities.desk_list ADD VALUE IF NOT EXISTS 'inbox';
ALTER TYPE activities.desk_list ADD VALUE IF NOT EXISTS 'refined';
ALTER TYPE activities.desk_list ADD VALUE IF NOT EXISTS 'done';
ALTER TYPE activities.triage_status ADD VALUE IF NOT EXISTS 'failed';

ALTER TABLE activities.events
  ADD COLUMN IF NOT EXISTS in_next_issue boolean NOT NULL DEFAULT false;
ALTER TABLE activities.resources
  ADD COLUMN IF NOT EXISTS in_next_issue boolean NOT NULL DEFAULT false;

-- Shared Desk settings (replaces the per-browser localStorage issue date).
CREATE TABLE IF NOT EXISTS activities.desk_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE activities.desk_settings ENABLE ROW LEVEL SECURITY;
