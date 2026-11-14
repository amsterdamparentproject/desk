// components/Column.tsx
import { MapPin, Check, ArrowRight, Edit, NotepadText } from 'lucide-react'
import { Location } from '../types/activity'

export function LocationCard({
  location,
  onDetails,
  onAdvance,
  onDecide,
}: {
  location: Location
  onDetails?: (loc: Location) => void
  onAdvance?: (id: string) => void // Review -> Refine
  onDecide?: (id: string, inPost: boolean) => void // Refine -> Gone (In Post / Not in Post)
}) {
  return (
    <div className="relative bg-surface rounded-xl border-2 border-violet-200 hover:border-violet-400 shadow-sm overflow-hidden flex flex-col transition-all">
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex justify-between items-start">
          <span className="text-xs font-black bg-violet-600 text-white px-1.5 py-0.5 rounded tracking-wider">
            Location
          </span>
          {onDetails && (
            <button
              onClick={() => onDetails(location)}
              className="text-xs font-black hover:text-blue-300 text-blue-400 uppercase flex items-center gap-1"
            >
              <Edit size={12} /> Edit
            </button>
          )}
        </div>

        {/* Name */}
        <h3
          onClick={() => onDetails?.(location)}
          className="font-black text-slate-900 text-sm leading-tight uppercase tracking-tight cursor-pointer hover:text-violet-300 transition-colors"
        >
          {location.name}
        </h3>

        {/* Meta */}
        <div className="space-y-1">
          {(location.neighborhood || location.area) && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <MapPin size={10} className="mt-0.5 shrink-0" />
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="text-[10px] font-bold text-slate-700 uppercase">
                  {location.neighborhood || ''}
                  {location.neighborhood && location.area
                    ? ` (${location.area})`
                    : (location.area ?? '')}
                </span>
                {location.address && (
                  <span className="text-[10px] truncate italic text-slate-400">
                    {location.address}
                  </span>
                )}
              </div>
            </div>
          )}
          {location.description && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <NotepadText size={12} className="mt-0.5 shrink-0" />
              <span className="text-xs text-slate-500 line-clamp-3">
                {location.description}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer buttons */}
      {(onAdvance || onDecide) && (
        <div
          className="flex h-10 px-2 py-1.5 gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {onAdvance && (
            <button
              type="button"
              onClick={() => onAdvance(location.id)}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-violet-300 bg-violet-50 hover:bg-violet-600 hover:text-white transition-colors uppercase"
            >
              <Check size={14} strokeWidth={3} /> Accept to refine
            </button>
          )}
          {onDecide && (
            <>
              <button
                type="button"
                onClick={() => onDecide(location.id, true)}
                className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-300 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase"
              >
                <Check size={14} strokeWidth={3} /> In Post
              </button>
              <button
                type="button"
                onClick={() => onDecide(location.id, false)}
                className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors uppercase"
              >
                <ArrowRight size={12} /> Not in Post
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
