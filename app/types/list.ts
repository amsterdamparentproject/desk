export type Tab = 'capture' | 'triage' | 'newsletter' | 'archived'

export type ListId =
  | 'ideas'
  | 'capture'
  | 'review'
  | 'error'
  | 'next_newsletter'
  | 'upcoming_events'
  | 'new_resources'

export interface ListProps {
  id: ListId
  label: string
  finishLabel?: string
  finishTarget?: (type: 'event' | 'resource') => ListId
}

export const CAPTURE_LISTS: ListProps[] = [
  { id: 'capture', label: 'Capture', finishLabel: 'Capture details', finishTarget: () => 'review' },
  { id: 'ideas',   label: 'Ideas',   finishLabel: 'Capture details', finishTarget: () => 'capture' },
]

export const TRIAGE_LISTS: ListProps[] = [
  { id: 'review', label: 'To review', finishLabel: 'Done editing', finishTarget: t => t === 'event' ? 'upcoming_events' : 'new_resources' },
  { id: 'error',  label: 'Errors',    finishLabel: 'Done editing', finishTarget: t => t === 'event' ? 'upcoming_events' : 'new_resources' },
]

export const NEWSLETTER_LISTS: ListProps[] = [
  { id: 'upcoming_events', label: 'Upcoming events', finishLabel: 'Add to newsletter', finishTarget: () => 'next_newsletter' },
  { id: 'new_resources',   label: 'New resources',   finishLabel: 'Add to newsletter', finishTarget: () => 'next_newsletter' },
  { id: 'next_newsletter', label: 'Next newsletter' },
]

export const ALL_LISTS: ListProps[] = [...CAPTURE_LISTS, ...TRIAGE_LISTS, ...NEWSLETTER_LISTS];

export function getListTab(listId: ListId): Tab {
  if (CAPTURE_LISTS.some(list => list.id === listId)) {
    return 'capture';
  }
  
  if (TRIAGE_LISTS.some(list => list.id === listId)) {
    return 'triage';
  }
  
  if (NEWSLETTER_LISTS.some(list => list.id === listId)) {
    return 'newsletter';
  }

  // Default to capture
  return 'capture';
}