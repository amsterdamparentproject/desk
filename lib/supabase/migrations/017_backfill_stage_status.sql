-- Stage/status refactor, step 2 of 2: backfill to the new model.
-- DO NOT RUN until 016 has been applied AND the Desk release that reads
-- inbox/refined/done/failed/in_next_issue is deployed. Run it right after the
-- deploy: until then the new Desk would see no rows, and after it the old Desk
-- would. See __claude__/list-refactor-plan.md.
--
-- Each UPDATE reads only OLD column values on its right-hand side, so the
-- CASE expressions below are all evaluated against the pre-update row.
-- status is compared as text so this also runs where the 'edited' enum value
-- still exists (the dev database).
BEGIN;

-- Events and resources
UPDATE activities.events SET
  in_next_issue = (
    list_id = 'next_newsletter'
    AND status::text NOT IN ('published', 'archived')
    AND 'newsletter' = ANY (services)
  ),
  status = (CASE
    WHEN status::text = 'archived' THEN 'archived'
    WHEN list_id = 'error' AND status::text <> 'processing' THEN 'failed'
    WHEN list_id IN ('ideas', 'capture', 'review', 'refine')
         AND parse_error IS NOT NULL
         AND status::text <> 'processing' THEN 'failed'
    WHEN status::text IN ('accepted', 'edited', 'snoozed') THEN 'processed'
    ELSE status::text
  END)::activities.triage_status,
  list_id = (CASE
    WHEN status::text = 'archived' THEN 'done'
    WHEN list_id = 'gone' THEN 'done'
    WHEN list_id IN ('ideas', 'capture', 'review', 'refine', 'error') THEN 'inbox'
    WHEN status::text = 'published' AND cardinality(services) = 0 THEN 'done'
    ELSE 'refined'
  END)::activities.desk_list;

UPDATE activities.resources SET
  in_next_issue = (
    list_id = 'next_newsletter'
    AND status::text NOT IN ('published', 'archived')
    AND 'newsletter' = ANY (services)
  ),
  status = (CASE
    WHEN status::text = 'archived' THEN 'archived'
    WHEN list_id = 'error' AND status::text <> 'processing' THEN 'failed'
    WHEN list_id IN ('ideas', 'capture', 'review', 'refine')
         AND parse_error IS NOT NULL
         AND status::text <> 'processing' THEN 'failed'
    WHEN status::text IN ('accepted', 'edited', 'snoozed') THEN 'processed'
    ELSE status::text
  END)::activities.triage_status,
  list_id = (CASE
    WHEN status::text = 'archived' THEN 'done'
    WHEN list_id = 'gone' THEN 'done'
    WHEN list_id IN ('ideas', 'capture', 'review', 'refine', 'error') THEN 'inbox'
    WHEN status::text = 'published' AND cardinality(services) = 0 THEN 'done'
    ELSE 'refined'
  END)::activities.desk_list;

-- Locations: 'gone' was the accepted state (postpartum_post decided in/out of
-- Post). Accepted-for-Post becomes refined; rejected becomes done; everything
-- still being triaged becomes inbox.
UPDATE activities.locations SET
  status = (CASE
    WHEN status::text = 'archived' THEN 'archived'
    WHEN status::text IN ('accepted', 'edited', 'snoozed', 'published') THEN 'processed'
    ELSE status::text
  END)::activities.triage_status,
  list_id = (CASE
    WHEN status::text = 'archived' THEN 'done'
    WHEN list_id = 'gone' AND postpartum_post THEN 'refined'
    WHEN list_id = 'gone' THEN 'done'
    ELSE 'inbox'
  END)::activities.desk_list;

-- Playgrounds: imported reference data, all accepted.
UPDATE activities.playgrounds SET
  status = (CASE WHEN status::text = 'new' THEN 'processed' ELSE status::text END)
    ::activities.triage_status,
  list_id = 'refined';

-- New defaults for new rows.
ALTER TABLE activities.events      ALTER COLUMN list_id SET DEFAULT 'inbox';
ALTER TABLE activities.resources   ALTER COLUMN list_id SET DEFAULT 'inbox';
ALTER TABLE activities.locations   ALTER COLUMN list_id SET DEFAULT 'inbox';
ALTER TABLE activities.playgrounds ALTER COLUMN list_id SET DEFAULT 'refined';

COMMIT;
