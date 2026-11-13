-- Records what happened when the AI parsed a capture, so a card never just
-- sits in "Processing" or lands in a list with no explanation.
--
--   parse_error    why the last parse failed / timed out (NULL when it worked)
--   parse_warnings things worth a human look after a successful parse
--                  (past date, AI called an event a resource, possible
--                  duplicate, skipped split events, ...)
--   parse_raw      raw AI output kept only for failed parses, for debugging
--
-- Run manually in the Supabase SQL editor. The app tolerates this migration
-- not being applied yet (it retries writes without these columns), so it is
-- safe to deploy first, but no reasons or warnings show until it is run.

ALTER TABLE activities.events
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS parse_warnings text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parse_raw jsonb;

ALTER TABLE activities.resources
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS parse_warnings text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parse_raw jsonb;
