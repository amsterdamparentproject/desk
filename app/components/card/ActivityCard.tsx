import { Check, Trash2, X } from 'lucide-react'
import { Card } from './Card'
import { CardProps } from '../../types/card'
import { ALL_LISTS } from '../../types/list'

export function ActivityCard({ activity, onDetails, onMove, onArchive, onToggleService }: CardProps) {
  const isProcessing = activity.status === 'processing'
  const list = ALL_LISTS.find(l => l.id === activity.list_id)
  const showApprove = !isProcessing && !!(list?.finishLabel && list?.finishTarget && onMove)
  const showArchive = !isProcessing && !!onArchive
  const showRemove = !isProcessing && activity.list_id === 'next_newsletter' && !!onMove

  return (
    <Card activity={activity} onDetails={onDetails} onMove={onMove} onArchive={onArchive} onToggleService={onToggleService}>
      {(showApprove || showArchive || showRemove) && (
        <div className="flex h-10 px-2 py-1.5 gap-1">
          {showRemove && (
            <button
              onClick={() => onMove!(activity.id, activity.type === 'resource' ? 'new_resources' : 'upcoming_events')}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-colors uppercase"
            >
              <X size={12} /> Remove
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
          {showArchive && (
            <button
              onClick={() => onArchive!(activity.id)}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-colors uppercase"
            >
              <Trash2 size={12} /> Archive
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
