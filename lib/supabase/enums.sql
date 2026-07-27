-- 0. Create the schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS activities;

-- 1. Desk List: The "Location" in your workspace
-- 'refine' and 'gone' were added in 010_add_gone_list.sql.
CREATE TYPE activities.desk_list AS ENUM (
  'ideas',
  'capture',
  'review',
  'error',
  'refine',
  'next_newsletter',
  'upcoming_events',
  'new_resources',
  'gone'
);

-- 2. Triage Status: The "Health/Phase" of the record
-- 'edited' was retired in 012_drop_edited_status.sql — 'accepted' is the
-- status stamped once something is promoted into Upcoming (see
-- 010_add_gone_list.sql for the original rationale).
CREATE TYPE activities.triage_status AS ENUM (
  'new',
  'processing',
  'processed',
  'accepted',
  'published',
  'archived',
  'snoozed'
);

-- 3. Capture Source: Where did this come from?
CREATE TYPE activities.capture_source AS ENUM (
  'app_desk',
  'app_website',
  'manual',
  'luma'
);

-- 4. Day Name: For automated grouping
CREATE TYPE activities.day_name AS ENUM (
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
);

CREATE TYPE activities.repeat_frequency AS ENUM (
  'daily', 'weekly', 'biweekly', 'monthly'
);