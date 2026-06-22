-- Add sources table for tracking sites/calendars to regularly scrape
create table activities.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  fetch_type text not null check (fetch_type in ('ical', 'api', 'scrape', 'rss')),
  config jsonb,
  active boolean default true,
  last_fetched_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
