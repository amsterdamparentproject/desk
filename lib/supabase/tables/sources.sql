-- Sources: sites and calendars to regularly scrape for events
create table activities.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  fetch_type text not null check (fetch_type in ('ical', 'api', 'scrape', 'rss')),
  config jsonb,              -- source-specific options e.g. {"calendar_id": "xyz"} or {"selector": ".event-title"}
  active boolean default true,
  last_fetched_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
