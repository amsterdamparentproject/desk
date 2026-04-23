export type ListId =
  | 'ideas'
  | 'capture'
  | 'review'
  | 'newsletter'
  | 'archive'
  | 'error'
  | 'upcoming'

export interface ListProps {
  id: ListId
  label: string
}

export const CAPTURE_LISTS: ListProps[] = [
  { id: 'ideas', label: 'Ideas' },
  { id: 'capture', label: 'Capture' },
]

export const TRIAGE_LISTS: ListProps[] = [
  { id: 'review', label: 'To Review' },
  { id: 'error', label: 'Errors' },
]

export const NEWSLETTER_LISTS: ListProps[] = [
  { id: 'upcoming', label: 'Upcoming Events' },
  { id: 'newsletter', label: 'Next Newsletter' },
]
