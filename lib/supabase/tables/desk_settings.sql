-- Shared Desk settings, e.g. key 'newsletter_issue_date' (YYYY-MM-DD).
CREATE TABLE activities.desk_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE activities.desk_settings ENABLE ROW LEVEL SECURITY;
