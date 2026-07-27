-- Resources are never eligible for Post — the Postpartum Post repo's matcher
-- only queries events, locations, and playgrounds (never resources), so a
-- resource tagged postpartum_post was always inert data, not a real signal.
--
-- 011_backfill_accepted_and_default_services.sql tagged resources with
-- postpartum_post as part of a broader "default both services on" backfill,
-- before this was caught. This undoes that for resources specifically —
-- applied to every resource regardless of status/list_id, since the rule is
-- unconditional (unlike 011's active-pipeline-only scope).
UPDATE activities.resources
SET services = array_remove(services, 'postpartum_post'),
    postpartum_post = false;

-- New resources should start false too, not true — app code only sets
-- postpartum_post explicitly when 'postpartum_post' is in services (which
-- resources should never have), so without this the DB default would keep
-- silently reintroducing postpartum_post = true on every new resource row.
ALTER TABLE activities.resources ALTER COLUMN postpartum_post SET DEFAULT false;
