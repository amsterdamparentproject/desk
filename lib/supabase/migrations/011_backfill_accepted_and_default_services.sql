-- Follow-up to 010_add_gone_list.sql, which added 'accepted' as the new
-- status for pipeline-active items but deliberately left old 'edited' rows
-- untouched (Postgres enums are additive-only, so 'edited' still exists as
-- a legacy value). Those legacy rows never match `status === 'accepted' ||
-- status === 'published'`, so they were invisible in the Included tab and
-- other 'accepted'-gated views. This backfills them.
UPDATE activities.events    SET status = 'accepted' WHERE status = 'edited';
UPDATE activities.resources SET status = 'accepted' WHERE status = 'edited';

-- One-time default: every activity still active in the pipeline (not yet
-- published or archived, not sitting in the Errors sub-section, and not
-- already settled in Gone) gets tagged for both services out of the gate.
-- Before the services column existed, everything was implicitly both; this
-- restores that baseline so existing rows show up in Newsletter/Post rather
-- than defaulting to invisible ('{}'). postpartum_post is kept in sync with
-- the array, matching the app's own sync logic (saveActivity /
-- handleToggleService). Gone items are excluded on purpose — they've already
-- exited the pipeline (aged out or settled) and shouldn't be reactivated by
-- this backfill.
UPDATE activities.events
SET services = ARRAY(SELECT DISTINCT unnest(services || ARRAY['newsletter', 'postpartum_post']::text[])),
    postpartum_post = true
WHERE status NOT IN ('published', 'archived')
  AND list_id NOT IN ('error', 'gone');

UPDATE activities.resources
SET services = ARRAY(SELECT DISTINCT unnest(services || ARRAY['newsletter', 'postpartum_post']::text[])),
    postpartum_post = true
WHERE status NOT IN ('published', 'archived')
  AND list_id NOT IN ('error', 'gone');
