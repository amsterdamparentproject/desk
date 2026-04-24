// components/Column.tsx
import { ChevronDown, ChevronRight } from 'lucide-react'
import { CompactCard } from './CompactCard'
import { InboxForm } from './InboxForm'
import { NewsletterEvent } from '../types/event'
import { ListProps, ListId } from '../types/list'

interface ColumnProps {
  list: ListProps
  isOpen: boolean
  onToggle: () => void
  events: NewsletterEvent[]
  onDetails: (event: NewsletterEvent) => void
  onMove: (id: string, targetList: ListId) => void
  onAddEvent: (event: NewsletterEvent) => void
}

export function Column({
  list,
  isOpen,
  onToggle,
  events,
  onDetails,
  onMove,
  onAddEvent,
}: ColumnProps) {
  // Bridge the InboxForm data to our global event state
  const handleInboxAdd = (data: {
    id: string
    list_id: ListId
    description: string
    file: File | null
  }) => {
    onAddEvent({
      id: data.id,
      list_id: data.list_id,
      title: data.description.split('\n')[0].substring(0, 50) || 'New Event',
      description: data.description,
      newsletterDescription: data.description,
      url: '',
      area: '',
      add_to_calendar: true,
      is_highlight: false,
    })
  }

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
        disabled={typeof window !== 'undefined' && window.innerWidth >= 768}
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
          {events.length}
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
              <InboxForm onAdd={handleInboxAdd} listId={list.id} />
            </div>
          )}

          {events.length === 0 ? (
            <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">
              Nothing to see here 🌬️ 🛼
            </div>
          ) : (
            events.map((event) => (
              <CompactCard
                key={event.id}
                event={event}
                onDetails={onDetails}
                onMove={onMove}
              />
            ))
          )}
        </div>
      </div>
    </section>
  )
}
