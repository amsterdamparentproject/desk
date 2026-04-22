// components/EventCard.tsx
import { useState } from 'react'
import { ChevronDown, ChevronUp, Calendar, MapPin, ExternalLink, Trash2, CheckCircle } from 'lucide-react'
import { NewsletterEvent } from '../types/event'

export function EventCard({ event, onUpdate, onMove }: { 
  event: NewsletterEvent, 
  onUpdate: (updated: NewsletterEvent) => void,
  onMove: (id: string, target: string) => void 
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleChange = (field: keyof NewsletterEvent, value: any) => {
    onUpdate({ ...event, [field]: value })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all">
      {/* 1. PRIMARY CONTENT (Always Visible) */}
      <div className="p-4">
        {/* Full Title */}
        <textarea
          value={event.title}
          onChange={(e) => handleChange('title', e.target.value)}
          className="w-full font-bold text-slate-900 text-lg leading-tight bg-transparent border-none p-0 focus:ring-0 resize-none overflow-hidden"
          placeholder="Event Title"
        />
      </div>

      {/* 2. EXPANDABLE SECTION (Metadata) */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-center gap-1 py-1 bg-slate-50 text-slate-400 hover:text-slate-600 border-y border-slate-100 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase">{isExpanded ? 'Show Less' : 'Edit Details'}</span>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isExpanded && (
        <div className="p-4 bg-slate-50 grid grid-cols-1 gap-4 border-b border-slate-100">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Newsletter Blurb</label>
          <textarea
            value={event.newsletterDescription}
            onChange={(e) => handleChange('newsletterDescription', e.target.value)}
            rows={4}
            className="w-full text-sm text-slate-600 bg-slate-50 rounded-lg p-2 border-none focus:ring-1 focus:ring-blue-200 leading-relaxed italic"
            placeholder="Write the newsletter blurb here..."
          />
        </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Newsletter Description */}
            <EditableInput label="Date" value={event.startDate} onChange={(v) => handleChange('startDate', v)} />
            <EditableInput label="Time" value={event.startTime} onChange={(v) => handleChange('startTime', v)} />
            <EditableInput label="Neighborhood" value={event.neighborhood} onChange={(v) => handleChange('neighborhood', v)} />
            <EditableInput label="Age Group" value={event.age} onChange={(v) => handleChange('age', v)} />
          </div>
          <EditableInput label="Location" value={event.location} onChange={(v) => handleChange('location', v)} />
          <EditableInput label="Organization" value={event.organization} onChange={(v) => handleChange('organization', v)} />
        </div>
      )}

      {/* 3. FOOTER ACTIONS */}
      <div className="p-3 bg-white flex items-center gap-2">
        {/* Toggle Calendar - Simplified Icon Style */}
        <button 
          onClick={() => handleChange('addToCalendar', !event.addToCalendar)}
          className={`p-2 rounded-lg border transition-colors ${event.addToCalendar ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-300'}`}
          title="Toggle Google Calendar"
        >
          <Calendar size={18} />
        </button>

        <a href={event.url} target="_blank" className="p-2 text-slate-400 hover:text-blue-500 border border-transparent">
          <ExternalLink size={18} />
        </a>

        <div className="flex-1" />

        <button onClick={() => onMove(event.id, 'archive')} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
          <Trash2 size={18} />
        </button>

        {event.list_id === 'review' && (
          <button 
            onClick={() => onMove(event.id, 'upcoming')}
            className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Approve <CheckCircle size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// Helper Sub-component for clean labeling
function EditableInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold text-slate-400 uppercase">{label}</label>
      <input 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={value}
        className="text-xs bg-white border border-slate-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-300 outline-none truncate"
      />
    </div>
  )
}