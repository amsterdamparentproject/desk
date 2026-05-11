import { Check, Trash2 } from 'lucide-react'
import { Card } from './Card'
import { CardProps } from '../../types/card'
import { ALL_LISTS } from '../../types/list'

export function ActivityCard({ activity, onDetails, onMove, onArchive, onSnooze }: CardProps) {
  const isProcessing = activity.status === 'processing'
  const list = ALL_LISTS.find(l => l.id === activity.list_id)
  const showApprove = !isProcessing && !!(list?.finishLabel && list?.finishTarget && onMove)
  const showArchive = !isProcessing && !!onArchive

  return (
    <Card activity={activity} onDetails={onDetails} onMove={onMove} onArchive={onArchive} onSnooze={onSnooze}>
      {(showApprove || showArchive) && (
        <div className="flex h-10 px-2 py-1.5 gap-1">
          {showArchive && (
            <button
              onClick={() => onArchive!(activity.id)}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-colors uppercase"
            >
              <Trash2 size={12} /> Archive
            </button>
          )}
          {showApprove && (
            <button
              onClick={() => onMove!(activity.id, list!.finishTarget!(activity.type))}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase"
            >
              <Check size={14} strokeWidth={3} /> {list!.finishLabel}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
