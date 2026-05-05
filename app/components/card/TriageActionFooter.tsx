import { Check, Trash2 } from 'lucide-react'
import { CardProps } from '../../types/card'

export function TriageActionFooter({ activity, onMove, onArchive, showApproveButton }: CardProps) {
  return (
    <div className="flex h-10 px-2 py-1.5 gap-1">
    { onArchive && 
        <button
            onClick={() => onArchive(activity.id)}
            className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-colors uppercase"
            >
            <Trash2 size={12} />
            Archive
        </button>
    }

    { showApproveButton && onMove && 
        <button
            onClick={() => onMove(activity.id, 'upcoming_events')}
            className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase"
            >
            <Check size={14} strokeWidth={3} />
            Looks Good
        </button>
    }
    </div>
  )
}