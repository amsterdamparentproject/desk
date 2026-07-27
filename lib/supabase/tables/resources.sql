CREATE TABLE activities.resources (
  -- Metadata & Identifiers
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Workflow & State (APP Desk)
  list_id activities.desk_list NOT NULL DEFAULT 'ideas',
  status activities.triage_status NOT NULL DEFAULT 'new',
  source activities.capture_source NOT NULL DEFAULT 'manual',
  snooze_until timestamptz,
  last_triaged_at timestamptz,
  triage_notes text,
  file_url text,
  
  -- Core Content (AI Parser Output)
  title text NOT NULL,
  description text NOT NULL,
  url text,
  organization text,
  age_range text,
  age_categories text[] DEFAULT '{}', -- auto-computed via sync_age_categories trigger; manual overrides preserved
  categories text[] DEFAULT '{}',
  
  -- Newsletter & Calendar Tracking
  newsletter_description text,
  newsletter_last date,
  newsletter_highlight boolean DEFAULT false,

  -- Postpartum Post — resources are never eligible (013_resources_never_in_post.sql):
  -- the Postpartum Post repo's matcher only queries events, locations, and playgrounds.
  postpartum_post boolean NOT NULL DEFAULT false,

  -- Services this activity is a candidate for / confirmed for: 'newsletter',
  -- 'postpartum_post'. Additive alongside postpartum_post — application code
  -- keeps that boolean synced to whether 'postpartum_post' is in this array.
  services text[] NOT NULL DEFAULT '{}',

  -- Location Details
  location text,
  neighborhood text,
  area text,
  latitude numeric(9, 6),
  longitude numeric(9, 6)
);

CREATE INDEX resources_lat_lng_idx ON activities.resources (latitude, longitude);