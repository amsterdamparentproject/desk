CREATE TABLE activities.resources (
  -- Metadata & Identifiers
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Workflow & State (APP Desk)
  list_id activities.desk_list NOT NULL DEFAULT 'capture',
  status activities.triage_status NOT NULL DEFAULT 'new',
  source activities.capture_source NOT NULL DEFAULT 'manual',
  snooze_until timestamptz,
  last_triaged_at timestamptz,
  triage_notes text,
  
  -- Core Content (AI Parser Output)
  title text NOT NULL,
  description text NOT NULL,
  url text,
  organization text,
  age_range text,
  categories text[] DEFAULT '{}',
  
  -- Newsletter & Calendar Tracking
  newsletter_description text NOT NULL,
  newsletter_last date,
  newsletter_highlight boolean DEFAULT false,
  
  -- Location Details
  location text,
  neighborhood text,
  area text
);