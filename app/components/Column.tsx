// components/Column.tsx
import { ChevronDown, ChevronRight, MapPin, Check, ArrowRight, Edit, NotepadText } from 'lucide-react'
import { ActivityCard, CaptureCardForm } from './card'
import { CaptureDataProps, DeskActivity, Location, Service } from '../types/activity'
import { ListProps, ListId } from '../types/list'
import { useEffect, useState } from 'react'

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function isInNewsletterWindow(activity: DeskActivity, windowStart: string, windowEnd: string): boolean {
  const inWindow = (date: string | null | undefined) =>
    !!date && date >= windowStart && (!windowEnd || date <= windowEnd)
  return inWindow(activity.start_date) || inWindow(activity.repeat_next_date)
}

interface ColumnProps {
  list: ListProps
  isOpen: boolean
  onToggle: () => void
  activities: DeskActivity[]
  onDetails: (activity: DeskActivity) => void
  onMove: (id: string, targetList: ListId) => void
  onArchive: (id: string) => void
  onToggleService?: (id: string, service: Service, enabled: boolean) => void
  onAddEvent: (activity: CaptureDataProps) => void
  pastEvents?: DeskActivity[]
  // Extra collapsible groups rendered below the main list, sourced from other
  // list_id values folded into this column visually (e.g. Errors/New under Capture).
  extraGroups?: { key: string; label: string; activities: DeskActivity[] }[]
  publishDate: string
  color?: 'orange' | 'blue' | 'violet'
}

const COLUMN_HEADER_CLASSES: Record<'orange' | 'blue' | 'violet', { bg: string; badgeBg: string }> = {
  orange: { bg: 'bg-orange-500', badgeBg: 'bg-orange-600' },
  blue:   { bg: 'bg-blue-600',   badgeBg: 'bg-blue-700' },
  violet: { bg: 'bg-violet-600', badgeBg: 'bg-violet-700' },
}

export function Column({
  list,
  isOpen,
  onToggle,
  activities,
  onDetails,
  onMove,
  onArchive,
  onToggleService,
  onAddEvent,
  pastEvents = [],
  extraGroups = [],
  publishDate,
  color = 'orange',
}: ColumnProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [pastEventsOpen, setPastEventsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  const extraGroupsTotal = extraGroups.reduce((sum, g) => sum + g.activities.length, 0)

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
          isOpen
            ? `${COLUMN_HEADER_CLASSES[color].bg} text-white`
            : 'bg-slate-50 text-slate-700'
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
          <h2 className="text-[10px] font-black uppercase tracking-widest">
            {list.label}
          </h2>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isOpen
              ? `${COLUMN_HEADER_CLASSES[color].badgeBg} text-white`
              : 'bg-slate-200 text-slate-500 md:bg-slate-100'
          }`}
        >
          {activities.length + extraGroupsTotal}
        </span>
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-all duration-300 md:transition-none md:opacity-100 md:max-h-none ${
          isOpen ? 'max-h-[60vh] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-3 space-y-3 bg-slate-100 md:bg-transparent h-full max-h-[60vh] md:max-h-none overflow-y-auto">
          {list.id === 'ideas' && (
            <div className="sticky top-0 z-10 mb-2 bg-slate-100 md:bg-white/80 md:backdrop-blur-sm">
              <CaptureCardForm onAdd={onAddEvent} listId={list.id} />
            </div>
          )}
          {list.id === 'upcoming_events' && color !== 'blue' && (
            <InlineCaptureAdd onAddEvent={onAddEvent} listId={list.id} />
          )}

          {activities.length === 0 ? (
            // Capture always shows the two capture forms (and often the
            // Errors/New groups below) — an empty-state message here is just
            // noise between them.
            list.id === 'ideas' ? null : (
              <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">
                Nothing to see here 🌬️ 🛼
              </div>
            )
          ) : list.id === 'upcoming_events' ? (
            <UpcomingEventsContent
              activities={activities}
              onDetails={onDetails}
              onMove={onMove}
              onArchive={onArchive}
              onToggleService={onToggleService}
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
                onToggleService={onToggleService}
                />
            ))
          )}

          {list.id === 'review' && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => pastEvents.length > 0 && setPastEventsOpen(v => !v)}
                className={`w-full flex items-center gap-2 py-2 px-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  pastEvents.length > 0
                    ? 'text-amber-500 hover:text-amber-600 cursor-pointer'
                    : 'text-slate-300 cursor-default'
                }`}
              >
                {pastEventsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Past events
                <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  pastEvents.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-300'
                }`}>
                  {pastEvents.length}
                </span>
              </button>
              {pastEventsOpen && pastEvents.length > 0 && (
                <div className="space-y-3 mt-1">
                  {pastEvents.map(activity => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      onDetails={onDetails}
                      onMove={onMove}
                      onArchive={onArchive}
                      onToggleService={onToggleService}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {extraGroups.length > 0 && (
            <div className="mt-2 space-y-2">
              {extraGroups.map(group => {
                const collapsed = collapsedGroups.has(group.key)
                return (
                  <div key={group.key}>
                    <button
                      type="button"
                      onClick={() => group.activities.length > 0 && toggleGroup(group.key)}
                      className={`w-full flex items-center gap-2 py-2 px-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                        group.activities.length > 0
                          ? 'text-amber-500 hover:text-amber-600 cursor-pointer'
                          : 'text-slate-300 cursor-default'
                      }`}
                    >
                      {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      {group.label}
                      <span className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        group.activities.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-300'
                      }`}>
                        {group.activities.length}
                      </span>
                    </button>
                    {!collapsed && group.activities.length > 0 && (
                      <div className="space-y-3 mt-1">
                        {group.activities.map(activity => (
                          <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onDetails={onDetails}
                            onMove={onMove}
                            onArchive={onArchive}
                            onToggleService={onToggleService}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
  onToggleService?: (id: string, service: Service, enabled: boolean) => void
  publishDate: string
}

function UpcomingEventsContent({ activities, onDetails, onMove, onArchive, onToggleService, publishDate }: UpcomingEventsContentProps) {
  const [showFuture, setShowFuture] = useState(false)

  const windowStart = new Date().toISOString().split('T')[0]
  const windowEnd = addDays(publishDate, 15) // Account for events happening on the last day of the period

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
            onToggleService={onToggleService}
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
                  onToggleService={onToggleService}
                    />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function LocationCard({ location, onDetails, onAdvance, onDecide }: {
  location: Location
  onDetails?: (loc: Location) => void
  onAdvance?: (id: string) => void // Review -> Refine
  onDecide?: (id: string, inPost: boolean) => void // Refine -> Gone (In Post / Not in Post)
}) {
  return (
    <div className="relative bg-white rounded-xl border-2 border-violet-200 hover:border-violet-400 shadow-sm overflow-hidden flex flex-col transition-all">
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex justify-between items-start">
          <span className="text-xs font-black bg-violet-600 text-white px-1.5 py-0.5 rounded tracking-wider">
            Location
          </span>
          {onDetails && (
            <button
              onClick={() => onDetails(location)}
              className="text-xs font-black hover:text-blue-600 text-blue-400 uppercase flex items-center gap-1"
            >
              <Edit size={12} /> Edit
            </button>
          )}
        </div>

        {/* Name */}
        <h3
          onClick={() => onDetails?.(location)}
          className="font-black text-slate-900 text-sm leading-tight uppercase tracking-tight cursor-pointer hover:text-violet-600 transition-colors"
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
                  {location.neighborhood || ''}{location.neighborhood && location.area ? ` (${location.area})` : location.area ?? ''}
                </span>
                {location.address && <span className="text-[10px] truncate italic text-slate-400">{location.address}</span>}
              </div>
            </div>
          )}
          {location.description && (
            <div className="flex items-start gap-1.5 text-slate-500">
              <NotepadText size={12} className="mt-0.5 shrink-0" />
              <span className="text-xs text-slate-500 line-clamp-3">{location.description}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer buttons */}
      {(onAdvance || onDecide) && (
        <div className="flex h-10 px-2 py-1.5 gap-1" onClick={e => e.stopPropagation()}>
          {onAdvance && (
            <button
              type="button"
              onClick={() => onAdvance(location.id)}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-violet-600 bg-violet-50 hover:bg-violet-600 hover:text-white transition-colors uppercase"
            >
              <Check size={14} strokeWidth={3} /> Accept to refine
            </button>
          )}
          {onDecide && (
            <>
              <button
                type="button"
                onClick={() => onDecide(location.id, true)}
                className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 hover:bg-green-600 hover:text-white transition-colors uppercase"
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

function InlineCaptureAdd({ onAddEvent, listId }: { onAddEvent: (data: CaptureDataProps) => void, listId: ListId }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="sticky top-0 z-10 mb-2 md:backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 py-2 text-slate-400 hover:text-slate-600 transition-colors group"
      >
        <div className="flex-1 h-px bg-slate-300 group-hover:bg-slate-400 transition-colors" />
        <span className="text-sm font-black leading-none select-none">{open ? '×' : '+'}</span>
        <div className="flex-1 h-px bg-slate-300 group-hover:bg-slate-400 transition-colors" />
      </button>
      {open && (
        <CaptureCardForm
          onAdd={(data) => { onAddEvent(data); setOpen(false) }}
          listId={listId}
        />
      )}
    </div>
  )
}
