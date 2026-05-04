// components/CompactCard.tsx
import { NewsletterEvent, CaptureEvent } from '../types/event'
import { Check, Trash2, Edit, MapPin, Clock, NotepadText, MoreHorizontal, ArrowBigRight, ArrowRight } from 'lucide-react'
import { ALL_LISTS, ListId } from '../types/list'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  event: CaptureEvent | NewsletterEvent
  onDetails: (event: NewsletterEvent) => void
  onMove: (id: string, target: ListId) => void
}

export function CompactCard({ event, onDetails, onMove }: Props) {
  const isTriage = ['ideas', 'capture', 'review', 'error'].includes(event.list_id)
  const isCaptureEvent = 'title' in event === false // CaptureEvent doesn't have title

  // Display date & time - only for NewsletterEvent
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return ''

    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })
  }

  const displayDate = isCaptureEvent ? '' : (
    (event as NewsletterEvent).startDate === (event as NewsletterEvent).endDate
      ? formatDate((event as NewsletterEvent).startDate)
      : `${formatDate((event as NewsletterEvent).startDate)} – ${formatDate((event as NewsletterEvent).endDate)}`
  )

  const displayTime = isCaptureEvent ? '' : `${(event as NewsletterEvent).startTime} - ${(event as NewsletterEvent).endTime}`
  // Handle move dropdown

  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const handleMove = (listId: ListId) => {
    onMove(event.id, listId)
    setShowMoveMenu(false)
  }

  const handleMoveClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
    }
    setShowMoveMenu(!showMoveMenu)
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 transition-all ${showMoveMenu ? 'z-[100]' : 'z-0'}`}>
      <div className="p-3 space-y-2">
        {/* 1. Header: Date & Details Button */}
        <div className="flex justify-between items-start">
          <span className="text-xs font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wider">
            {displayDate ? displayDate : 'No date'}
          </span>

        <div className="flex flex-row gap-3">
          {/* Move action */}
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={handleMoveClick}
              className="text-xs font-black hover:text-blue-600 text-blue-400 uppercase flex items-center gap-1"
            >
              <ArrowRight size={12} />
              Move
            </button>

            {/* Move dropdown */}
           {showMoveMenu && menuPos && createPortal(
              <>
                <div
                  className="fixed inset-0 z-[110] cursor-default"
                  onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false); }}
                />
                <div
                  className="absolute w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-[120] py-1 animate-in fade-in zoom-in-95 duration-100"
                  style={{ top: menuPos.top, left: menuPos.left }}
                >
                  {ALL_LISTS.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      disabled={event.list_id === list.id}
                      onClick={() => handleMove(list.id as ListId)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      {list.label}
                      {event.list_id === list.id && <div className="w-1 h-1 bg-blue-600 rounded-full" />}
                    </button>
                  ))}
                </div>
              </>,
              document.body
            )}
            </div>
            
            {/* Edit action - only show for NewsletterEvent */}
            {!isCaptureEvent && (
              <button
                onClick={() => onDetails(event as NewsletterEvent)}
                className="text-xs font-black hover:text-blue-600 text-blue-400 uppercase flex items-center gap-1"
              >
                <Edit size={12} />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* 2. Title: Bold & Uppercase */}
        <h3 className="font-black text-slate-900 text-sm leading-tight uppercase tracking-tight">
          {isCaptureEvent ? '✨ Processing...' : (event as NewsletterEvent).title}
        </h3>

        {/* 3. New Metadata Rows */}
        <div className="space-y-2">
          {/* Description for CaptureEvent */}
          {isCaptureEvent && event.description && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <NotepadText size={10} className="flex-shrink-0 mt-0.5" />
              <span className="text-[10px] italic text-slate-400 leading-tight">
                {event.description}
              </span>
            </div>
          )}

          {/* Time Range - only for NewsletterEvent */}
          {!isCaptureEvent && (event as NewsletterEvent).startTime && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={10} className="flex-shrink-0" />
              <span className="text-[10px] font-bold">{displayTime}</span>
            </div>
          )}

          {/* Neighborhood & Address - only for NewsletterEvent */}
          {!isCaptureEvent && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <MapPin size={10} className="flex-shrink-0 mt-0.5" />
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="text-[10px] font-bold text-slate-700 uppercase">
                  {(event as NewsletterEvent).neighborhood} ({(event as NewsletterEvent).area})
                </span>
                <span className="text-[10px] truncate italic text-slate-400">
                  {(event as NewsletterEvent).location}
                </span>
              </div>
            </div>
          )}

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
