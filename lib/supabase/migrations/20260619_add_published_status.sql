-- Add 'published' status to triage_status enum
-- Distinguishes newsletter-published records from manually archived ones.
-- Run directly in the Supabase SQL editor.

ALTER TYPE activities.triage_status ADD VALUE 'published';

-- Backfill: archived records with a newsletter_last date were published via the newsletter flow
UPDATE activities.events    SET status = 'published' WHERE status = 'archived' AND newsletter_last IS NOT NULL;
UPDATE activities.resources SET status = 'published' WHERE status = 'archived' AND newsletter_last IS NOT NULL;
