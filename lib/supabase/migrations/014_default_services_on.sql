-- Previously both tables defaulted `services` to '{}'. Any insert path that
-- didn't explicitly set services — captureFromShare, the n8n AI-enrichment
-- callback/upsert paths, and ordinary Capture/Review/Refine records created
-- before the app-level seeding fix — silently landed with no service. Those
-- rows are invisible in the Newsletter/Post tabs (filtered by
-- services.includes(...)) even once accepted and promoted to Upcoming,
-- which is how events kept going "missing."
--
-- Events default to both Newsletter + Post. Resources default to Newsletter
-- only — resources are never eligible for Post (013_resources_never_in_post.sql):
-- the Postpartum Post matcher only queries events, locations, and playgrounds.
-- Matches the existing postpartum_post column defaults (events: true, resources: false).
ALTER TABLE activities.events    ALTER COLUMN services SET DEFAULT ARRAY['newsletter', 'postpartum_post'];
ALTER TABLE activities.resources ALTER COLUMN services SET DEFAULT ARRAY['newsletter'];
