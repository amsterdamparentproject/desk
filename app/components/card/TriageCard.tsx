import { Check, Trash2 } from 'lucide-react'
import { Card } from './Card'
import { CardProps } from '../../types/card'
import { TriageActionFooter } from './TriageActionFooter'

export function TriageCard({ activity, onDetails, onMove, onArchive }: CardProps) {
  return (
    <Card
      activity={activity}
      onDetails={onDetails}
      onMove={onMove}
      onArchive={onArchive}
      showEditButton={true}
    >
      <TriageActionFooter
        activity={activity}
        onMove={onMove}
        onArchive={onArchive}
       />
    </Card>
  )
}