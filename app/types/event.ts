import { ListId } from './list'

export interface CaptureEvent {
  id: string
  list_id: ListId
  description: string
  file: File | null
}

export interface NewsletterEvent {
  id: string
  list_id: ListId

  // Date & Time
  startDate?: string // "2026-04-26"
  startTime?: string // "11:00"
  endDate?: string
  endTime?: string
  duration?: number // 45

  // Content
  title: string
  description: string
  newsletterDescription: string
  url: string

  // Location & Taxonomy
  area: string // "South"
  location?: string
  neighborhood?: string
  organization?: string
  age?: string // "0-6 years"

  // Metadata
  day_of_week?: string // "Sunday"
  is_highlight?: boolean
  add_to_calendar?: boolean
  repeat?: string | null
  repeatFrequency?: string | null
  file?: File | null
}
