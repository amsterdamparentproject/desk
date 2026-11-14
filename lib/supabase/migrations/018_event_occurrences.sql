-- Multiple dates per event, each with its own optional start/end time.
-- [{ "date": "2026-12-03", "start_time": "10:00", "end_time": "11:30" }, ...]
-- When non-empty, start_date / end_date / start_time / end_time are kept in
-- sync by Desk (first date, last date, first date's times) so consumers that
-- only know the single-range model keep working. Empty = legacy single range.
ALTER TABLE activities.events
  ADD COLUMN IF NOT EXISTS occurrences jsonb NOT NULL DEFAULT '[]'::jsonb;
