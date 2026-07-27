-- Desk pipeline redesign: adds two new desk_list stages and a services tag.
--
-- 'refine' — a new stage between Triage's Review/Error accept and Upcoming.
--   Accepting something out of Triage now lands here first (data still needs
--   polishing) before being promoted into upcoming_events/new_resources.
--
-- 'gone' — the unified resting place for activities that have exited the
--   active pipeline entirely: rejected at triage (status: archived), or
--   dropped from every tagged service (status: archived if it aged out /
--   was never selected, published if a service's edition actually ran it).
--
-- upcoming_events / new_resources / next_newsletter are unchanged — they
-- already represent the per-type "Upcoming" split and the "Next newsletter"
-- list exactly as before.
--
-- Must run each statement outside an explicit transaction block (Supabase
-- SQL editor runs statements this way by default; ALTER TYPE ... ADD VALUE
-- cannot run inside one).
ALTER TYPE activities.desk_list ADD VALUE IF NOT EXISTS 'gone';
ALTER TYPE activities.desk_list ADD VALUE IF NOT EXISTS 'refine';

-- Services tag: which distribution channel(s) an activity is a candidate for
-- or confirmed for — 'newsletter' and/or 'postpartum_post'. Additive
-- alongside the existing postpartum_post boolean (which a separate repo
-- reads directly) — application code keeps the boolean in sync whenever
-- 'postpartum_post' enters or leaves this array, so nothing downstream breaks.
ALTER TABLE activities.events ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}';
ALTER TABLE activities.resources ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}';

-- 'accepted' replaces 'edited' going forward as the status stamped once
-- something is promoted into Upcoming — it reflects pipeline position
-- ("confirmed good, in the active pipeline") rather than "someone touched a
-- field". It's additive: old rows may still carry 'edited', which remains a
-- valid (if now legacy) enum value since Postgres can't drop enum members.
--
-- 'accepted' persists all the way through Upcoming -> Next -> Gone unless a
-- service's edition actually runs it (-> 'published') or it's explicitly
-- rejected via the hard Archive action (-> 'archived'). This is what lets
-- Gone/Archived distinguish "explicitly rejected" from "aged out, but was
-- never rejected" without needing a separate date field.
ALTER TYPE activities.triage_status ADD VALUE IF NOT EXISTS 'accepted';
