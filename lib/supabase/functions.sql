-- 1. The Updated At Function
CREATE OR REPLACE FUNCTION activities.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. The Day of Week Function
CREATE OR REPLACE FUNCTION activities.update_event_day_of_week()
RETURNS TRIGGER AS $$
BEGIN
    -- Explicitly reference the enum within the activities schema
    NEW.day_of_week := TRIM(TO_CHAR(NEW.start_date, 'Day'))::activities.day_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. The Triggers
-- Note: We qualify both the table and the function
CREATE TRIGGER set_updated_at_events 
    BEFORE UPDATE ON activities.events 
    FOR EACH ROW 
    EXECUTE FUNCTION activities.handle_updated_at();

CREATE TRIGGER trigger_update_day_of_week
    BEFORE INSERT OR UPDATE OF start_date ON activities.events
    FOR EACH ROW 
    EXECUTE FUNCTION activities.update_event_day_of_week();

CREATE TRIGGER set_updated_at_resources 
    BEFORE UPDATE ON activities.resources 
    FOR EACH ROW 
    EXECUTE FUNCTION activities.handle_updated_at();