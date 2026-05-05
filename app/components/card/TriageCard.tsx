import { Check, Trash2 } from 'lucide-react'
import { Card } from './Card'
import { CardProps } from '../../types/card'

export function TriageCard({ activity, onDetails, onMove, onArchive }: CardProps) {
  return (
    <Card
      activity={activity}
      onDetails={onDetails}
      onMove={onMove}
      onArchive={onArchive}
      showApproveButton={true}
      showEditButton={true}
    >
      {/* Triage Action Footer */}
      <div className="flex h-10 px-2 py-1.5 gap-1">
        <button
          onClick={() => onArchive(activity.id)}
          className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-colors uppercase"
        >
          <Trash2 size={12} />
          Archive
        </button>

        <button
          onClick={() => onMove(activity.id, 'upcoming_events')}
          className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase"
        >
          <Check size={14} strokeWidth={3} />
          Looks Good
        </button>
      </div>
    </Card>
  )
}