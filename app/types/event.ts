// types/event.ts

export type ListId = 'incoming' | 'review' | 'newsletter' | 'archive' | 'error' | 'upcoming';

export interface NewsletterEvent {
  // Logic Fields (Required for the UI)
  id: string; 
  list_id: ListId;
  
  // Date & Time
  startDate: string;        // "2026-04-26"
  startTime: string;        // "11:00"
  endDate: string;
  endTime: string;
  duration: number;         // 45
  
  // Content
  title: string;
  description: string;
  newsletterDescription: string;
  url: string;
  
  // Location & Taxonomy
  location: string;
  neighborhood: string;
  area: string;             // "South"
  organization: string;
  age: string;              // "0-6 years"
  
  // Metadata
  day_of_week: string;      // "Sunday"
  is_highlight: boolean;
  add_to_calendar?: boolean;
  repeat: string | null;
  repeatFrequency: string | null;
}