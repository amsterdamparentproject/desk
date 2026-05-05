import { ListId } from './list'
import { TriageStatus } from './card'

export type CaptureSource = 'app_desk' | 'app_website' | 'manual'
export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly';

/**
 * 1. THE SHARED BASELINE
 */
export interface BaseActivity {
  // Metadata
  id: string;
  created_at: string;
  updated_at: string;

  // Workflow & state (APP Desk)
  list_id: ListId;
  status: TriageStatus;
  source: CaptureSource;
  snooze_until: string | null;
  last_triaged_at: string | null;
  triage_notes: string | null;
  file_url: string | null;

  // Core content
  title: string;
  description: string;
  url: string | null;
  organization: string | null;
  age_range: string | null;
  categories: string[];

  // Newsletter
  newsletter_description: string;
  newsletter_last: string | null;
  newsletter_highlight: boolean;

  // Location
  location: string | null;
  neighborhood: string | null;
  area: string | null;
}

/**
 * 2. PRODUCTION STRUCTURES (Strict definitions for fully triaged records)
 */
export interface EventActivity extends BaseActivity {
  start_date: string; 
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  day_of_week: DayName | null;
  duration_minutes: number | null;

  // Repeat
  repeat_rrule: string | null;
  repeat_frequency: RepeatFrequency | null;
  repeat_next_date: string | null;

  // Event-specific calendar tracking
  calendar_skip: boolean;
  calendar_sent: boolean;
}

export interface ResourceActivity extends BaseActivity {
  // Purely uses BaseActivity fields right now (e.g., title, description, url, organization)
}

/**
 * 3. CAPTURE & FORM INPUT PROPS
 */
export type CaptureDataProps = {
  list_id: ListId;
  description: string;
  file: File | null;
}

/**
 * 4. THE TRIAGE DESK WORKER STATE
 * This represents an item while it's in-flight or sitting in 'capture/triage' columns.
 * It merges all available fields making production variants optional so forms don't crash.
 */
export type DeskActivity = BaseActivity & {
  // Temporary browser state 
  file: File | null;
  preview_url: string | null;

  // Event specific properties made optional for staging
  start_date?: string; 
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  day_of_week?: DayName | null;
  duration_minutes?: number | null;
  repeat_rrule?: string | null;
  repeat_frequency?: RepeatFrequency | null;
  repeat_next_date?: string | null;
  calendar_skip?: boolean;
  calendar_sent?: boolean;
}

/**
 * 5. SEED DATA FACTORY
 * Generates a clean template matching our flexible DeskActivity type.
 */
export const createNewActivity = (
  description: string,
  overrides?: Partial<DeskActivity>
): DeskActivity => {
  const now = new Date().toISOString();

  const {
    file = null,
    preview_url = null,
    list_id = 'capture',
    ...remainingOverrides
  } = overrides || {};

  return {
    // Structural Defaults
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    status: 'new',
    source: 'app_desk',
    title: '✨ Processing...',
    description: description,
    newsletter_description: '',
    categories: [],
    
    // In-flight Local Attachments
    list_id,
    file,
    preview_url,

    // Database Fields Defaults
    file_url: null,
    url: null,
    organization: null,
    age_range: null,
    location: null,
    neighborhood: null,
    area: null,
    snooze_until: null,
    last_triaged_at: null,
    triage_notes: null,
    newsletter_last: null,
    newsletter_highlight: false,

    // Optional Event fields default state safely assigned if not overwritten
    calendar_skip: false,
    calendar_sent: false,

    ...remainingOverrides, 
  };
};