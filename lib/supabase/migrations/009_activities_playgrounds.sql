-- Create playground_type enums and activities.playgrounds table
-- Source data: buitenspeelkaart.nl (Speelplan / Gemeente Amsterdam)

CREATE TYPE activities.playground_type AS ENUM (
  'playground_association', -- speeltuin: Organized playground association (Speeltuinvereniging)
  'large_play_spot',        -- grotespeelplek
  'neighborhood_play_spot', -- buurtspeelplek
  'small_play_spot',        -- kleinespeelplek
  'play_corner',            -- speelhoekje
  'play_spot'               -- speelplek: Generic public play spot
);

CREATE TYPE activities.playground_type_nl AS ENUM (
  'speeltuin',
  'grotespeelplek',
  'buurtspeelplek',
  'kleinespeelplek',
  'speelhoekje',
  'speelplek'
);

CREATE TABLE activities.playgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- The venue name
  name text NOT NULL UNIQUE,

  -- Location
  address text,
  area text,
  neighborhood text,

  -- Playground-specific
  playground_type activities.playground_type,
  playground_type_nl activities.playground_type_nl,

  -- Additional details
  url text,
  description text,
  categories text[] DEFAULT '{}',
  age_categories text[] DEFAULT '{}',

  -- Coordinates
  latitude numeric(9, 6),
  longitude numeric(9, 6),

  -- Triage workflow
  list_id activities.desk_list NOT NULL DEFAULT 'ideas',
  status activities.triage_status NOT NULL DEFAULT 'new',
  triage_notes text,

  -- Postpartum Post
  postpartum_post boolean NOT NULL DEFAULT true
);

GRANT USAGE ON SCHEMA activities TO service_role;
GRANT SELECT ON activities.playgrounds TO service_role;