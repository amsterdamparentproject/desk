# TODOs

## Post tab

- [ ] **Date range** — Post matches go out on the 7th of the month, so activities before the 7th are never needed. Currently the range starts from today; could simplify to start from the 7th. Low complexity gain, not urgent.
- [ ] **Freeze match recommendations** — When a match goes out, snapshot the active `postpartum_post = true` activity IDs into a `matches` table (match date, participant IDs, activity IDs[]). The match page renders from that snapshot so activities can't disappear mid-conversation. Add a "New since your match" section for activities added after the snapshot — keeps the page fresh and supports marketing/retention without destabilizing the core list.
- [ ] **Two-tier delete** — If an activity has never been snapshotted into a match, allow hard delete (purge). If it has, nudge toward archive instead — or warn that hard-deleting will leave a gap in a past match. Aligns with existing `archived` status as soft delete.

## Locations

- [ ] **Capture form → locations** — Expand the capture form to include a locations tab/section so new locations can be added during triage
- [ ] **LocationDrawer** — Create a dedicated drawer for editing location fields (name, address, area, neighborhood, url, description, categories, postpartum_post)
- [ ] **Newsletter location name** — Add a "Host name" field to the location section in NewsletterDrawer, prefilled from `activity.organization` but editable; use that value as `location.name` rather than `activity.organization`
- [ ] **Populate locations** — Add more locations to the locations table
