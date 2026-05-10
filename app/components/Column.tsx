// components/Column.tsx
import { ChevronDown, ChevronRight } from 'lucide-react'
import { CaptureCard, TriageCard, NewsletterCard, CaptureCardForm } from './card'
import { CaptureDataProps, DeskActivity } from '../types/activity'
import { ListProps, ListId, TRIAGE_LISTS, NEWSLETTER_LISTS, CAPTURE_LISTS, getListTab } from '../types/list'
import { useEffect, useState } from 'react'

interface ColumnProps {
  list: ListProps
  isOpen: boolean
  onToggle: () => void
  activities: DeskActivity[]
  onDetails: (activity: DeskActivity) => void
  onMove: (id: string, targetList: ListId) => void
  onArchive: (id: string) => void
  onAddEvent: (activity: CaptureDataProps) => void
}

export function Column({
  list,
  isOpen,
  onToggle,
  activities,
  onDetails,
  onMove,
  onArchive,
  onAddEvent,
}: ColumnProps) {
  const handleCaptureAdd = (data: CaptureDataProps) => {
    onAddEvent({
      list_id: data.list_id,
      description: data.description,
      file: data.file,
    })
  }

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
              <CaptureCardForm onAdd={handleCaptureAdd} listId={list.id} />
            </div>
          )}

          {activities.length === 0 ? (
            <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">
              Nothing to see here 🌬️ 🛼
            </div>
          ) : (
            activities.map((activity) => {
              // Determine which card component to use based on list type
              const listTab = getListTab(list.id);

              if (list.id === 'ideas') {
                return (
                  <TriageCard
                    key={activity.id}
                    activity={activity}
                    onDetails={onDetails}
                    onMove={onMove}
                    onArchive={onArchive}
                  />
                )
              } else if (listTab === 'triage') {
                return (
                  <TriageCard
                    key={activity.id}
                    activity={activity}
                    onDetails={onDetails}
                    onMove={onMove}
                    onArchive={onArchive}
                  />
                )
              } else if (listTab === 'newsletter') {
                return (
                  <NewsletterCard
                    key={activity.id}
                    activity={activity}
                    onDetails={onDetails}
                    onMove={onMove}
                    onArchive={onArchive}
                  />
                )
              } else {
                return (
                  <CaptureCard
                    key={activity.id}
                    activity={activity}
                  />
                )
              }
            })
          )}
        </div>
      </div>
    </section>
  )
}
