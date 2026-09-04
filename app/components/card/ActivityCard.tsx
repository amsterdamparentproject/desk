import { Check, Trash2, X } from 'lucide-react'
import { Card } from './Card'
import { CardProps } from '../../types/card'
import { ALL_LISTS } from '../../types/list'

export function ActivityCard({ activity, onDetails, onMove, onArchive, onToggleService, showNotInPost }: CardProps) {
  const isProcessing = activity.status === 'processing'
  const list = ALL_LISTS.find(l => l.id === activity.list_id)
  const showApprove = !isProcessing && !!(list?.finishLabel && list?.finishTarget && onMove)
  // Refine's finish action promotes into Newsletter/Post queues — block it until
  // at least one service is chosen, since otherwise the card just disappears
  // (added to a list it isn't actually eligible to appear in for either service).
  const approveDisabled = activity.list_id === 'refine' && (activity.services ?? []).length === 0
  const showArchive = !isProcessing && !!onArchive
  const showRemove = !isProcessing && activity.list_id === 'next_newsletter' && !!onMove
  const showNotInPostBtn = !isProcessing && !!showNotInPost && !!onToggleService

  return (
    <Card activity={activity} onDetails={onDetails} onMove={onMove} onArchive={onArchive} onToggleService={onToggleService}>
      {(showApprove || showArchive || showRemove || showNotInPostBtn) && (
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
              disabled={approveDisabled}
              title={approveDisabled ? 'Choose Newsletter and/or Post before adding' : undefined}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase disabled:opacity-40 disabled:hover:bg-green-50 disabled:hover:text-green-600 disabled:cursor-not-allowed"
            >
              <Check size={14} strokeWidth={3} /> {list!.finishLabel}
            </button>
          )}
          {showNotInPostBtn && (
            <button
              onClick={() => onToggleService!(activity.id, 'postpartum_post', false)}
              title="Drops postpartum_post — moves to Gone once no services remain. Status is untouched, unlike Archive."
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-600 hover:text-white transition-colors uppercase"
            >
              <X size={12} /> Remove
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
