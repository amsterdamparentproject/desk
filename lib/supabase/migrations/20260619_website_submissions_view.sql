-- View: all events submitted via the APP website
CREATE VIEW activities.website_event_submissions AS
SELECT *
FROM activities.events
WHERE source = 'app_website'
ORDER BY created_at DESC;

-- View: all resources submitted via the APP website
CREATE VIEW activities.website_resource_submissions AS
SELECT *
FROM activities.resources
WHERE source = 'app_website'
ORDER BY created_at DESC;
