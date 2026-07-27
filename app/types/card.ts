import { BaseActivity, CaptureDataProps, DeskActivity, Service } from './activity'
import { ListId } from './list'

type CardAction =
  | 'approve'
  | 'move'
  | 'edit'
  | 'copy'
  | 'archive'

export type TriageStatus = 'new' | 'processing' | 'processed' | 'accepted' | 'published' | 'archived';

// Base card component props
export interface CardProps {
  activity: DeskActivity
  onDetails?: (activity: DeskActivity) => void // Only cards that have been processed can access the Edit pane
  onMove?: (id: string, target: ListId) => void
  onArchive?: (id: string) => void
  // Two-way toggle for the card-front Newsletter/Post service buttons.
  onToggleService?: (id: string, service: Service, enabled: boolean) => void
  showApproveButton?: boolean
  detailsAction?: React.ReactNode // Replaces the Edit button in the card header
  children?: React.ReactNode // For extending components to add custom footers
}

// Capture card component props: Just new events
export interface CaptureCardProps {
  onAdd: (data: CaptureDataProps) => void
  onAddLocation?: (data: { name: string; address: string; area?: string | null; neighborhood?: string | null }) => void
  listId: ListId
  locations?: import('./activity').Location[]
}