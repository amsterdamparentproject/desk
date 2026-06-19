-- Add postpartum_post flag to events, resources, and locations
-- Controls visibility in the Postpartum Post matching program
-- Strategy: backfill existing rows as false, then set default to true for new rows

ALTER TABLE activities.events
  ADD COLUMN postpartum_post boolean NOT NULL DEFAULT false;
ALTER TABLE activities.events
  ALTER COLUMN postpartum_post SET DEFAULT true;

ALTER TABLE activities.resources
  ADD COLUMN postpartum_post boolean NOT NULL DEFAULT false;
ALTER TABLE activities.resources
  ALTER COLUMN postpartum_post SET DEFAULT true;

ALTER TABLE activities.locations
  ADD COLUMN postpartum_post boolean NOT NULL DEFAULT false,
  ADD COLUMN url text,
  ADD COLUMN description text,
  ADD COLUMN categories text[] DEFAULT '{}';
ALTER TABLE activities.locations
  ALTER COLUMN postpartum_post SET DEFAULT true;
