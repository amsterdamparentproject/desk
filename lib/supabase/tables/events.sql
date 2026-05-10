CREATE TABLE activities.events (
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
  categories text[] DEFAULT '{}',
  
  -- Date & Time Logic
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  start_time time,
  end_time time,
  day_of_week activities.day_name,
  duration_minutes integer,
  
  -- Repeat & Strategy
  repeat_rrule text,
  repeat_frequency activities.repeat_frequency,
  repeat_next_date timestamptz,
  
  -- APP Website
  tagline text,

  -- Newsletter & Calendar Tracking
  newsletter_description text NOT NULL,
  newsletter_last date,
  newsletter_highlight boolean DEFAULT false,
  calendar_skip boolean DEFAULT false,
  calendar_sent boolean DEFAULT false,
  
  -- Location Details
  location text,
  neighborhood text,
  area text
);