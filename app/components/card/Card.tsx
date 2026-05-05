import { Edit, MapPin, Clock, NotepadText, ArrowRight } from 'lucide-react'
import { ALL_LISTS, ListId } from '../../types/list'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CardProps } from '../../types/card'
import { DeskActivity, EventActivity, ResourceActivity } from '@/app/types/activity'

export function Card({
  activity,
  onDetails,
  onMove,
  showEditButton = true,
  children
}: CardProps) {
  // 1. Type Guards & Data Preparation
  const isEvent = activity && Object.keys(activity).includes('start_date');
  const isNewActivity = activity.title === '✨ Processing...'
  
  // Cast once to avoid 'as' inside the JSX
  const eventData = isEvent ? (activity as EventActivity) : null;
  const resourceData = (!isEvent && !isNewActivity) 
  ? (activity as ResourceActivity) 
  : null;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // 2. Logic for Display Strings
  let displayDate = 'No date';
  let displayTime = '';

  if (eventData) {
    const start = eventData.start_date;
    const end = eventData.end_date;
    displayDate = (!end || start === end) 
      ? formatDate(start) 
      : `${formatDate(start)} – ${formatDate(end)}`;
    
    if (eventData.start_time) {
      displayTime = `${eventData.start_time} - ${eventData.end_time ?? ''}`;
    }
  }

  // 3. Dropdown State
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

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
        {/* Header: Date & Actions */}
        <div className="flex justify-between items-start">
          <span className="text-xs font-black bg-slate-900 text-white px-1.5 py-0.5 rounded tracking-wider">
            {displayDate}
          </span>

          <div className="flex flex-row gap-3">
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
                    className="absolute w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-[120] py-1"
                    style={{ top: menuPos.top, left: menuPos.left }}
                  >
                    {ALL_LISTS.map((list) => (
                      <button
                        key={list.id}
                        disabled={activity.list_id === list.id}
                        onClick={() => { onMove(activity.id, list.id as ListId); setShowMoveMenu(false); }}
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

            {showEditButton && !isNewActivity && (
              <button
                onClick={() => onDetails(activity as DeskActivity)}
                className="text-xs font-black hover:text-blue-600 text-blue-400 uppercase flex items-center gap-1"
              >
                <Edit size={12} /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-black text-slate-900 text-sm leading-tight uppercase tracking-tight">
          {isNewActivity ? '✨ Processing...' : activity.title}
        </h3>

        {/* Metadata Rows */}
        <div className="space-y-2">
          {isNewActivity && activity.description && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <NotepadText size={10} className="mt-0.5" />
              <span className="text-[10px] italic text-slate-400 leading-tight">
                {activity.description}
              </span>
            </div>
          )}

          {eventData?.start_time && (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={10} />
              <span className="text-[10px] font-bold">{displayTime}</span>
            </div>
          )}

          {!isNewActivity && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <MapPin size={10} className="mt-0.5" />
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="text-[10px] font-bold text-slate-700 uppercase">
                  {activity.neighborhood} ({activity.area ?? 'No Area'})
                </span>
                <span className="text-[10px] truncate italic text-slate-400">
                  {activity.location}
                </span>
              </div>
            </div>
          )}

          {!isNewActivity && (eventData || resourceData)?.newsletter_description && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <NotepadText size={10} className="mt-0.5" />
              <span className="text-xs text-slate-500 line-clamp-3">
                {isEvent ? eventData?.newsletter_description : resourceData?.newsletter_description}
              </span>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}