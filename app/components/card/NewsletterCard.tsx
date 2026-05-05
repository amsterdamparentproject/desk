import { Card } from './Card'
import { CardProps } from '../../types/card'

export function NewsletterCard({ activity, onDetails, onMove, onArchive }: CardProps) {
  return (
    <Card
      activity={activity}
      onDetails={onDetails}
      onMove={onMove}
      onArchive={onArchive}
      showApproveButton={false} // Already approved
      showEditButton={true} // Review cards show edit button
    >
      {/* No footer for review cards */}
    </Card>
  )
}