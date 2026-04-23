export type ListId =
  | 'incoming'
  | 'review'
  | 'newsletter'
  | 'archive'
  | 'error'
  | 'upcoming'

export interface ListProps {
  id: ListId
  label: string
}

export const TRIAGE_LISTS: ListProps[] = [
  { id: 'incoming', label: 'Incoming' },
  { id: 'review', label: 'To Review' },
  { id: 'error', label: 'Errors' },
]

export const NEWSLETTER_LISTS: ListProps[] = [
  { id: 'upcoming', label: 'Upcoming Events' },
  { id: 'newsletter', label: 'Next Newsletter' },
]
