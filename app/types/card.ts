import { BaseActivity, CaptureDataProps, DeskActivity } from './activity'
import { ListId } from './list'

type CardAction =
  | 'approve'
  | 'move'
  | 'edit'
  | 'copy'
  | 'archive'
  | 'snooze'

export type TriageStatus = 'new' | 'processing' | 'processed' | 'edited' | 'archived' | 'snoozed';

// Base card component props
export interface CardProps {
  activity: DeskActivity
  onDetails?: (activity: DeskActivity) => void // Only cards that have been processed can access the Edit pane
  onMove?: (id: string, target: ListId) => void
  onArchive?: (id: string) => void
  showApproveButton?: boolean
  children?: React.ReactNode // For extending components to add custom footers
}

// Capture card component props: Just new events
export interface CaptureCardProps {
  onAdd: (data: CaptureDataProps) => void
  listId: ListId
}