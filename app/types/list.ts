export type Tab = 'triage' | 'newsletter' | 'post' | 'locations' | 'published' | 'included' | 'archived'

export type ListId =
  | 'ideas'
  | 'capture'
  | 'review'
  | 'error'
  | 'refine'
  | 'next_newsletter'
  | 'upcoming_events'
  | 'new_resources'
  | 'gone'

export interface ListProps {
  id: ListId
  label: string
  finishLabel?: string
  finishTarget?: (type: 'event' | 'resource') => ListId
}

// 'capture' kept here so it appears in the "In list" drawer dropdown for legacy records
export const CAPTURE_LISTS: ListProps[] = [
  { id: 'capture', label: 'Capture', finishLabel: 'Accept', finishTarget: () => 'review' },
]

// Triage is shared by both services — Refine lives here now (not under Newsletter),
// since "is it good for APP at all" is a decision made before either service's
// own Upcoming/Match queue.
export const TRIAGE_LISTS: ListProps[] = [
  { id: 'ideas',  label: 'Capture',     finishLabel: 'Send to review', finishTarget: () => 'review' },
  { id: 'review', label: 'To review',  finishLabel: 'Accept',   finishTarget: () => 'refine' },
  { id: 'error',  label: 'Errors',     finishLabel: 'Accept',   finishTarget: () => 'refine' },
  { id: 'refine', label: 'Refine',     finishLabel: 'Add to Upcoming', finishTarget: t => t === 'event' ? 'upcoming_events' : 'new_resources' },
]

export const NEWSLETTER_LISTS: ListProps[] = [
  { id: 'upcoming_events', label: 'Upcoming events', finishLabel: 'Add', finishTarget: () => 'next_newsletter' },
  { id: 'new_resources',   label: 'New resources',   finishLabel: 'Add', finishTarget: () => 'next_newsletter' },
  { id: 'next_newsletter', label: 'Next newsletter' },
]

// Post tab has no ListProps entry of its own — it's events-only (Post never
// takes resources; the Postpartum Post matcher only queries events,
// locations, and playgrounds) and its three sections (Upcoming events,
// Recurring Events, Match) are all computed splits of the same
// upcoming_events rows filtered by services.includes('postpartum_post'),
// rendered as bespoke browse/QA lists directly in Board.tsx rather than
// through the generic Column component. No finishLabel/finishTarget —
// nothing to promote into.

// 'gone' is the unified resting place for anything that has exited the active
// pipeline — rejected at triage (archived), rejected for a newsletter issue but
// still fine for Post (status unchanged), or published in an issue (published).
// It only ever appears in the Published/Included/Archived tabs, never as a working column.
export const GONE_LISTS: ListProps[] = [
  { id: 'gone', label: 'Gone' },
]

export const ALL_LISTS: ListProps[] = [...CAPTURE_LISTS, ...TRIAGE_LISTS, ...NEWSLETTER_LISTS, ...GONE_LISTS];

export function getListTab(listId: ListId): Tab {
  if (TRIAGE_LISTS.some(list => list.id === listId) || listId === 'capture') {
    return 'triage';
  }
  if (NEWSLETTER_LISTS.some(list => list.id === listId)) {
    return 'newsletter';
  }
  // 'gone' (and any other terminal state) belongs in Published/Included/Archived, never Triage.
  return 'archived';
}
