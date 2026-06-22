-- Add age_categories to events, resources, and locations
-- age_categories: standardized multi-select buckets derived from (or complementing) age_range text

ALTER TABLE activities.events
  ADD COLUMN IF NOT EXISTS age_categories text[] DEFAULT '{}';

ALTER TABLE activities.resources
  ADD COLUMN IF NOT EXISTS age_categories text[] DEFAULT '{}';

ALTER TABLE activities.locations
  ADD COLUMN IF NOT EXISTS age_categories text[] DEFAULT '{}';
