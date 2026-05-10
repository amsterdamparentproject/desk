import { Check, Trash2 } from 'lucide-react'
import { CardProps } from '../../types/card'
import { ALL_LISTS } from '../../types/list'

export function TriageActionFooter({ activity, onMove, onArchive, showApproveButton }: CardProps) {
  const list = ALL_LISTS.find(l => l.id === activity.list_id)

  return (
    <div className="flex h-10 px-2 py-1.5 gap-1">
      {onArchive && (
        <button
          onClick={() => onArchive(activity.id)}
          className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-colors uppercase"
        >
          <Trash2 size={12} />
          Archive
        </button>
      )}

      {showApproveButton && onMove && list?.finishLabel && list?.finishTarget && (
        <button
          onClick={() => onMove(activity.id, list.finishTarget!(activity.type))}
          className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase"
        >
          <Check size={14} strokeWidth={3} />
          {list.finishLabel}
        </button>
      )}
    </div>
  )
}