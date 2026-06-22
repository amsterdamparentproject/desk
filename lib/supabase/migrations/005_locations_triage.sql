-- Add triage fields to locations so they can flow through the Desk Kanban

ALTER TABLE activities.locations
  ADD COLUMN list_id activities.desk_list NOT NULL DEFAULT 'ideas',
  ADD COLUMN status activities.triage_status NOT NULL DEFAULT 'new',
  ADD COLUMN triage_notes text;

-- Existing locations are already reviewed/confirmed — move them out of the capture queue
UPDATE activities.locations
  SET list_id = 'ideas', status = 'edited';
