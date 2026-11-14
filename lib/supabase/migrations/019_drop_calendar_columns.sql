-- Desk no longer tracks calendar state. Drop the two event columns.
-- Run manually in the Supabase SQL editor (prod and dev), AFTER the Desk
-- release that stops reading and writing them has deployed.
--
-- activities.app_events and activities.event_submissions are SELECT * views
-- whose column lists were frozen when they were created, so they depend on
-- calendar_skip / calendar_sent. They have to be dropped and recreated around
-- the column drop (same definitions as tables/events.sql and
-- 003_website_submissions_view.sql, plus their grants).

DROP VIEW activities.event_submissions;
DROP VIEW activities.app_events;

ALTER TABLE activities.events
  DROP COLUMN IF EXISTS calendar_skip,
  DROP COLUMN IF EXISTS calendar_sent;

CREATE VIEW activities.app_events
WITH (security_invoker = true) AS
SELECT *
FROM activities.events
WHERE organization = 'Amsterdam Parent Project'
WITH CASCADED CHECK OPTION;

CREATE VIEW activities.event_submissions
WITH (security_invoker = on) AS
SELECT *
FROM activities.events
WHERE source = 'app_website'
ORDER BY created_at DESC;

GRANT SELECT, INSERT, UPDATE, DELETE ON activities.app_events
  TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON activities.event_submissions
  TO authenticated, service_role;
