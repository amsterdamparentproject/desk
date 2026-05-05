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
}

export const CAPTURE_LISTS: ListProps[] = [
  { id: 'capture', label: 'Capture' },
  { id: 'ideas', label: 'Ideas' },
]

export const TRIAGE_LISTS: ListProps[] = [ 
  { id: 'review', label: 'To review' },
  { id: 'error', label: 'Errors' },
]

export const NEWSLETTER_LISTS: ListProps[] = [ // Actions: Accept, snooze, archive
  { id: 'upcoming_events', label: 'Upcoming events' },
  { id: 'new_resources', label: 'New resources' },
  { id: 'next_newsletter', label: 'Next newsletter' },
]

export const ALL_LISTS: ListProps[] = [...CAPTURE_LISTS, ...TRIAGE_LISTS, ...NEWSLETTER_LISTS];