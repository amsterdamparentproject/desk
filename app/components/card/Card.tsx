import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Edit, MapPin, Clock, NotepadText, ArrowRight, CalendarCheck, BellOff } from 'lucide-react'
import { ALL_LISTS, ListId } from '../../types/list'
import { CardProps } from '../../types/card'

// Helper function placed outside the component to prevent re-instantiation on every render
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function Card({
  activity,
  onDetails,
  onMove,
  onSnooze,
  detailsAction,
  children
}: CardProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const calIconRef = useRef<HTMLDivElement>(null)
  const [calTooltipPos, setCalTooltipPos] = useState<{ top: number; left: number } | null>(null)

  // 1. Derivations & Status Flag Checks
  const isNewActivity = activity.status === 'processing'
  const hasDate = Boolean(activity.start_date)

  // 2. Formatting Display Strings cleanly using our unified DeskActivity properties
  const displayDate = hasDate
    ? !activity.end_date || activity.start_date === activity.end_date
      ? formatDate(activity.start_date)
      : `${formatDate(activity.start_date)} – ${formatDate(activity.end_date)}`
    : 'No date'

  const displayTime = activity.start_time
    ? `${activity.start_time} - ${activity.end_time ?? ''}`
    : ''

  // 3. Dropdown Menu Positioning Trigger
  const handleMoveClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ 
        top: rect.bottom + window.scrollY + 4, 
        left: rect.left + window.scrollX 
      })
    }
    setShowMoveMenu(prev => !prev)
  }

  return (
    <div className={`relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-blue-300 transition-all ${showMoveMenu ? 'z-[100]' : 'z-0'}`}>
      <div className="p-3 space-y-2">
        
        {/* Header: Date Badge & Action Buttons */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wider">
              {displayDate}
            </span>
            <div
              ref={calIconRef}
              onMouseEnter={() => {
                const rect = calIconRef.current?.getBoundingClientRect()
                if (rect) setCalTooltipPos({ top: rect.top - 6, left: rect.left + rect.width / 2 })
              }}
              onMouseLeave={() => setCalTooltipPos(null)}
            >
              <CalendarCheck
                size={12}
                className={activity.calendar_sent ? 'text-green-500' : 'text-slate-300'}
              />
            </div>
            {calTooltipPos && createPortal(
              <div
                className="fixed -translate-x-1/2 -translate-y-full -mt-1.5 whitespace-nowrap bg-slate-800 text-white text-[10px] px-2 py-1 rounded pointer-events-none z-[200]"
                style={{ top: calTooltipPos.top, left: calTooltipPos.left }}
              >
                {activity.calendar_sent ? 'Added to calendar' : 'Not yet added to calendar'}
              </div>,
              document.body
            )}
          </div>

          <div className="flex flex-row gap-3">
            {/* Move Column Dropdown Action */}
            { onMove && !isNewActivity && (
              <div className="relative">
                <button
                  ref={buttonRef}
                  onClick={handleMoveClick}
                  className="text-xs font-black hover:text-blue-600 text-blue-400 uppercase flex items-center gap-1"
                >
                  <ArrowRight size={12} /> Move
                </button>

                {showMoveMenu && menuPos && createPortal(
                  <>
                    <div className="fixed inset-0 z-[110]" onClick={() => setShowMoveMenu(false)} />
                    <div
                      className="fixed w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-[120] py-1"
                      style={{ top: menuPos.top, left: menuPos.left }}
                    >
                      {ALL_LISTS.map((list) => (
                        <button
                          key={list.id}
                          disabled={activity.list_id === list.id}
                          onClick={() => { 
                            onMove(activity.id, list.id as ListId)
                            setShowMoveMenu(false)
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30"
                        >
                          {list.label}
                          {activity.list_id === list.id && <div className="w-1 h-1 bg-blue-600 rounded-full" />}
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body
                )}
              </div> 
            )}

            { onSnooze && !isNewActivity && (
              <button
                onClick={() => onSnooze(activity.id)}
                className="text-xs font-black hover:text-slate-600 text-slate-400 uppercase flex items-center gap-1"
              >
                <BellOff size={12} /> Snooze
              </button>
            )}

            {detailsAction ?? (onDetails && !isNewActivity && (
              <button
                onClick={() => onDetails(activity)}
                className="text-xs font-black hover:text-blue-600 text-blue-400 uppercase flex items-center gap-1"
              >
                <Edit size={12} /> Edit
              </button>
            ))}
          </div>
        </div>

        {/* Card Main Title */}
        <h3
          onClick={onDetails && !isNewActivity ? () => onDetails(activity) : undefined}
          className={`font-black text-slate-900 text-sm leading-tight uppercase tracking-tight ${onDetails && !isNewActivity ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
        >
          {activity.title}
        </h3>

        {/* Structural Descriptive Meta Rows */}
        <div className="space-y-2">
          {/* Time Span Row */}
          {activity.start_time && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={10} />
              <span className="text-[10px] font-bold">{displayTime}</span>
            </div>
          )}

          {/* Location & Neighborhood Row */}
          {!isNewActivity && (activity.location || activity.neighborhood) && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <MapPin size={10} className="mt-0.5" />
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="text-[10px] font-bold text-slate-700 uppercase">
                  {activity.neighborhood || 'Unknown Neighborhood'} ({activity.area || 'No Area'})
                </span>
                <span className="text-[10px] truncate italic text-slate-400">
                  {activity.location}
                </span>
              </div>
            </div>
          )}

          {/* AI Production Summary Field */}
          {!isNewActivity && activity.newsletter_description && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <NotepadText size={12} className="mt-0.5 shrink-0" />
              <span className="text-xs text-slate-500 line-clamp-3">
                {activity.newsletter_description}
              </span>
            </div>
          )}
        </div>
      </div>
      {children}

      {isNewActivity && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 z-10">
          <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing</span>
        </div>
      )}
    </div>
  )
}