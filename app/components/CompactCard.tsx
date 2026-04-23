// components/CompactCard.tsx
import { NewsletterEvent } from '../types/event'
import { Check, Trash2, Edit, MapPin, Clock, NotepadText } from 'lucide-react'
import { ListId } from '../types/list'

interface Props {
  event: NewsletterEvent
  onDetails: (event: NewsletterEvent) => void
  onMove: (id: string, target: ListId) => void
}

export function CompactCard({ event, onDetails, onMove }: Props) {
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return ''

    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })
  }

  const startFormatted = formatDate(event.startDate)
  const endFormatted = formatDate(event.endDate)

  const displayDate =
    event.startDate === event.endDate
      ? startFormatted
      : `${startFormatted} – ${endFormatted}`

  // Logic: Time range
  const displayTime = `${event.startTime} - ${event.endTime}`

  const isTriage = ['ideas', 'capture', 'review', 'error'].includes(event.list_id)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 transition-all">
      <div className="p-3 space-y-2">
        {/* 1. Header: Date & Details Button */}
        <div className="flex justify-between items-start">
          <span className="text-xs font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wider">
            {displayDate ? displayDate : 'No date'}
          </span>
          <button
            onClick={() => onDetails(event)}
            className="text-xs font-black hover:text-blue-600 text-blue-400 uppercase flex items-center gap-1"
          >
            <Edit size={12} />
            Edit
          </button>
        </div>

        {/* 2. Title: Bold & Uppercase */}
        <h3 className="font-black text-slate-900 text-sm leading-tight uppercase tracking-tight">
          {event.title}
        </h3>

        {/* 3. New Metadata Rows */}
        <div className="space-y-2">
          {/* Time Range */}
          {event.startTime && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={10} className="flex-shrink-0" />
              <span className="text-[10px] font-bold">{displayTime}</span>
            </div>
          )}

          {/* Neighborhood & Address */}
          <div className="flex items-start gap-1.5 text-slate-500">
            <MapPin size={10} className="flex-shrink-0 mt-0.5" />
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-[10px] font-bold text-slate-700 uppercase">
                {event.neighborhood} ({event.area})
              </span>
              <span className="text-[10px] truncate italic text-slate-400">
                {event.location}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-1.5 text-slate-500">
            <NotepadText size={10} className="flex-shrink-0 mt-0.5" />
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-xs text-slate-500">
                {event.newsletterDescription}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Triage Action Footer */}
      {isTriage && (
        <div className="flex h-10 px-2 py-1.5 gap-1">
          <button
            onClick={() => onMove(event.id, 'archive')}
            className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition-colors uppercase"
          >
            <Trash2 size={12} />
            Archive
          </button>

          <button
            onClick={() => onMove(event.id, 'upcoming')}
            className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase"
          >
            <Check size={14} strokeWidth={3} />
            Looks Good
          </button>
        </div>
      )}
    </div>
  )
}
