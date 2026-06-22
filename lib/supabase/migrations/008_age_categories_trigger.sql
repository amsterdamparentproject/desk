-- Trigger: auto-compute age_categories from age_range on events and resources.
--
-- Fires BEFORE INSERT OR UPDATE. Computes age_categories when:
--   1. age_categories is null or empty (e.g. new record, or manually cleared)
--   2. age_range has changed (recompute to stay in sync)
--
-- Manual overrides to age_categories are preserved as long as age_range is unchanged.

CREATE OR REPLACE FUNCTION activities.sync_age_categories()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.age_categories IS NULL OR NEW.age_categories = '{}')
     OR (TG_OP = 'UPDATE' AND NEW.age_range IS DISTINCT FROM OLD.age_range)
  THEN
    NEW.age_categories := activities._compute_age_categories(NEW.age_range);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_age_categories
BEFORE INSERT OR UPDATE ON activities.events
FOR EACH ROW EXECUTE FUNCTION activities.sync_age_categories();

CREATE TRIGGER sync_age_categories
BEFORE INSERT OR UPDATE ON activities.resources
FOR EACH ROW EXECUTE FUNCTION activities.sync_age_categories();
