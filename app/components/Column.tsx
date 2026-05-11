// components/Column.tsx
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ActivityCard, CaptureCardForm } from './card'
import { CaptureDataProps, DeskActivity } from '../types/activity'
import { ListProps, ListId } from '../types/list'
import { useEffect, useState } from 'react'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function isInNewsletterWindow(activity: DeskActivity, windowStart: string, windowEnd: string): boolean {
  const date = activity.start_date
  if (!date) return false
  return date >= windowStart && date <= windowEnd
}

interface ColumnProps {
  list: ListProps
  isOpen: boolean
  onToggle: () => void
  activities: DeskActivity[]
  onDetails: (activity: DeskActivity) => void
  onMove: (id: string, targetList: ListId) => void
  onArchive: (id: string) => void
  onSnooze: (id: string) => void
  onAddEvent: (activity: CaptureDataProps) => void
  publishDate: string
}

export function Column({
  list,
  isOpen,
  onToggle,
  activities,
  onDetails,
  onMove,
  onArchive,
  onSnooze,
  onAddEvent,
  publishDate,
}: ColumnProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();

    // Listen for resize so it stays reactive
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
      {/* Header */}
      <button
        type="button"
        onClick={() => {
          // Only allow toggle on mobile
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            onToggle()
          }
        }}
        disabled={isMobile ? false : true}
        className={`w-full flex items-center justify-between p-4 transition-colors md:cursor-default ${
          isOpen ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="md:hidden">
            {isOpen ? (
              <ChevronDown size={16} className="text-slate-400" />
            ) : (
              <ChevronRight size={16} className="text-slate-400" />
            )}
          </div>
          <h2 className="font-black text-xs uppercase tracking-tighter">
            {list.label}
          </h2>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isOpen
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-500 md:bg-slate-100'
          }`}
        >
          {activities.length}
        </span>
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-all duration-300 md:transition-none md:opacity-100 md:max-h-none ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-3 space-y-3 bg-slate-100 md:bg-transparent h-full overflow-y-auto">
          {(list.id === 'capture') && (
            <div className="sticky top-0 z-10 mb-2 bg-slate-100 md:bg-white/80 md:backdrop-blur-sm">
              <CaptureCardForm onAdd={onAddEvent} listId={list.id} />
            </div>
          )}

          {activities.length === 0 ? (
            <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">
              Nothing to see here 🌬️ 🛼
            </div>
          ) : list.id === 'upcoming_events' ? (
            <UpcomingEventsContent
              activities={activities}
              onDetails={onDetails}
              onMove={onMove}
              onArchive={onArchive}
              onSnooze={onSnooze}
              publishDate={publishDate}
            />
          ) : (
            activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onDetails={onDetails}
                onMove={onMove}
                onArchive={onArchive}
                onSnooze={onSnooze}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}

interface UpcomingEventsContentProps {
  activities: DeskActivity[]
  onDetails: (activity: DeskActivity) => void
  onMove: (id: string, targetList: ListId) => void
  onArchive: (id: string) => void
  onSnooze: (id: string) => void
  publishDate: string
}

function UpcomingEventsContent({ activities, onDetails, onMove, onArchive, onSnooze, publishDate }: UpcomingEventsContentProps) {
  const [showFuture, setShowFuture] = useState(false)

  const windowStart = publishDate
  const windowEnd = addDays(publishDate, 14)

  const windowActivities = activities.filter(a => isInNewsletterWindow(a, windowStart, windowEnd))
  const futureActivities = activities.filter(a => !isInNewsletterWindow(a, windowStart, windowEnd))

  return (
    <>
      {windowActivities.length === 0 ? (
        <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">
          Nothing in this newsletter window 🌬️
        </div>
      ) : (
        windowActivities.map(activity => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onDetails={onDetails}
            onMove={onMove}
            onArchive={onArchive}
            onSnooze={onSnooze}
          />
        ))
      )}

      {futureActivities.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowFuture(prev => !prev)}
            className="w-full flex items-center gap-2 py-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showFuture ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Future events
            <span className="ml-auto bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {futureActivities.length}
            </span>
          </button>

          {showFuture && (
            <div className="space-y-3 mt-1">
              {futureActivities.map(activity => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onDetails={onDetails}
                  onMove={onMove}
                  onArchive={onArchive}
                  onSnooze={onSnooze}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
