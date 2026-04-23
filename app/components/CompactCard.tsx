// components/CompactCard.tsx
import { NewsletterEvent, ListId } from '../types/event'
import { Check, Trash2, Edit, MapPin, Clock, NotepadText } from 'lucide-react'

interface Props {
  event: NewsletterEvent;
  onDetails: (event: NewsletterEvent) => void;
  onMove: (id: string, target: ListId) => void;
}

export function CompactCard({ event, onDetails, onMove }: Props) {
  // Logic: Single date vs Date range
  const displayDate = event.startDate === event.endDate 
    ? event.startDate 
    : `${event.startDate} — ${event.endDate}`;

  // Logic: Time range
  const displayTime = `${event.startTime} - ${event.endTime}`;

  const isTriage = ['incoming', 'review', 'error'].includes(event.list_id);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 transition-all">
      <div className="p-3 space-y-2">
        {/* 1. Header: Date & Details Button */}
        <div className="flex justify-between items-start">
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded tracking-wider">
            {displayDate}
          </span>
          <button 
            onClick={() => onDetails(event)}
            className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase flex items-center gap-1"
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
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock size={10} className="flex-shrink-0" />
            <span className="text-[10px] font-bold">{displayTime}</span>
          </div>

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
              <span className="text-[10px] text-slate-500">
                {event.newsletterDescription}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Triage Action Footer */}
      {isTriage && (
        <div className="flex border-t border-slate-100 h-10">
          <button
            onClick={() => onMove(event.id, 'archive')}
            className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border-r border-slate-100 uppercase"
          >
            <Trash2 size={12} />
            Archive
          </button>
          
          <button
            onClick={() => onMove(event.id, 'upcoming')}
            className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-green-600 hover:bg-green-50 transition-colors uppercase"
          >
            <Check size={14} strokeWidth={3} />
            Looks Good
          </button>
        </div>
      )}
    </div>
  )
}