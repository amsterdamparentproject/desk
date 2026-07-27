-- Permanently retires the legacy 'edited' status value now that
-- 011_backfill_accepted_and_default_services.sql has moved every events /
-- resources row off of it (and no app code writes 'edited' anymore).
--
-- Postgres enums can't drop a single value directly, so this rebuilds the
-- type: create a new enum without 'edited', swap every column that uses it
-- over to the new type, then drop the old one.
--
-- event_submissions / resource_submissions (003_website_submissions_view.sql)
-- and app_events (defined inline in tables/events.sql) are all `SELECT *`
-- views and therefore depend on every column of events / resources,
-- including status — they have to be dropped and recreated around the
-- column type change or Postgres will refuse to alter it.
--
-- activities.playgrounds (009_activities_playgrounds.sql) also has a status
-- column of this type — no views depend on it, so it just needs the same
-- type swap, no drop/recreate.
--
-- IMPORTANT: run 011_backfill_accepted_and_default_services.sql first and
-- confirm zero rows across events/resources/locations/playgrounds have
-- status = 'edited' before running this — the USING cast below will fail
-- otherwise.

-- Defensive: locations and playgrounds never used 'edited' in practice, but
-- backfill them too in case any slipped through, so the type swap below
-- can't fail on it.
UPDATE activities.locations SET status = 'accepted' WHERE status = 'edited';
UPDATE activities.playgrounds SET status = 'accepted' WHERE status = 'edited';

DROP VIEW activities.event_submissions;
DROP VIEW activities.resource_submissions;
DROP VIEW activities.app_events;

ALTER TYPE activities.triage_status RENAME TO triage_status_old;

CREATE TYPE activities.triage_status AS ENUM (
  'new',
  'processing',
  'processed',
  'accepted',
  'published',
  'archived',
  'snoozed'
);

ALTER TABLE activities.events ALTER COLUMN status DROP DEFAULT;
ALTER TABLE activities.events
  ALTER COLUMN status TYPE activities.triage_status
  USING status::text::activities.triage_status;
ALTER TABLE activities.events ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE activities.resources ALTER COLUMN status DROP DEFAULT;
ALTER TABLE activities.resources
  ALTER COLUMN status TYPE activities.triage_status
  USING status::text::activities.triage_status;
ALTER TABLE activities.resources ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE activities.locations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE activities.locations
  ALTER COLUMN status TYPE activities.triage_status
  USING status::text::activities.triage_status;
ALTER TABLE activities.locations ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE activities.playgrounds ALTER COLUMN status DROP DEFAULT;
ALTER TABLE activities.playgrounds
  ALTER COLUMN status TYPE activities.triage_status
  USING status::text::activities.triage_status;
ALTER TABLE activities.playgrounds ALTER COLUMN status SET DEFAULT 'new';

DROP TYPE activities.triage_status_old;

CREATE VIEW activities.event_submissions AS
SELECT *
FROM activities.events
WHERE source = 'app_website'
ORDER BY created_at DESC;

CREATE VIEW activities.resource_submissions AS
SELECT *
FROM activities.resources
WHERE source = 'app_website'
ORDER BY created_at DESC;

-- View: APP-owned events only. Supports SELECT, INSERT, UPDATE, DELETE.
-- WITH CHECK OPTION prevents writes that would set organization to anything
-- other than 'Amsterdam Parent Project'. (Definition mirrored from
-- tables/events.sql — kept identical to the original.)
CREATE VIEW activities.app_events
WITH (security_invoker = true) AS
SELECT *
FROM activities.events
WHERE organization = 'Amsterdam Parent Project'
WITH CHECK OPTION;
