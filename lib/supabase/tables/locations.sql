CREATE TABLE activities.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- The venue or organization name used to match against activities.organization
  name text NOT NULL UNIQUE,

  -- Address details
  address text NOT NULL,
  area text,
  neighborhood text,

  -- Additional details
  url text,
  description text,
  categories text[] DEFAULT '{}',

  -- Coordinates (optional, for future map use)
  latitude numeric(9, 6),
  longitude numeric(9, 6),

  -- Triage workflow
  list_id activities.desk_list NOT NULL DEFAULT 'ideas',
  status activities.triage_status NOT NULL DEFAULT 'new',
  triage_notes text,

  -- Postpartum Post
  postpartum_post boolean NOT NULL DEFAULT true
);

CREATE INDEX locations_lat_lng_idx ON activities.locations (latitude, longitude);

-- Auto-update updated_at on edit
CREATE TRIGGER set_updated_at_locations
  BEFORE UPDATE ON activities.locations
  FOR EACH ROW
  EXECUTE FUNCTION activities.handle_updated_at();
