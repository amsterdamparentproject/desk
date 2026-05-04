-- 0. Create the schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS activities;

-- 1. Desk List: The "Location" in your workspace
CREATE TYPE activities.desk_list AS ENUM (
  'ideas', 
  'capture', 
  'review', 
  'error', 
  'next_newsletter', 
  'upcoming_events', 
  'new_resources'
);

-- 2. Triage Status: The "Health/Phase" of the record
CREATE TYPE activities.triage_status AS ENUM (
  'new', 
  'processing', 
  'processed', 
  'edited', 
  'archived', 
  'snoozed'
);

-- 3. Capture Source: Where did this come from?
CREATE TYPE activities.capture_source AS ENUM (
  'app_desk', 
  'app_website', 
  'manual'
);

-- 4. Day Name: For automated grouping
CREATE TYPE activities.day_name AS ENUM (
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
);

CREATE TYPE activities.repeat_frequency AS ENUM (
  'daily', 'weekly', 'monthly'
);