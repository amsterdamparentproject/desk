'use client'
import { useState, useMemo } from 'react'
import { CompactCard } from './components/CompactCard'
import { DetailsForm } from './components/DetailsForm'
import { Column } from './components/Column'
import { NewsletterEvent, ListId } from './types/event'
import { MOCK_EVENTS } from './mockData' // Replace with Supabase fetch later

type Tab = 'triage' | 'newsletter'

interface ColumnDef {
  id: ListId;
  label: string;
}

const TRIAGE_COLUMNS: ColumnDef[] = [
  { id: 'incoming', label: 'Incoming' },
  { id: 'review', label: 'To Review' },
  { id: 'error', label: 'Errors' }
]

const NEWSLETTER_COLUMNS: ColumnDef[] = [
  { id: 'upcoming', label: 'Upcoming Events' },
  { id: 'newsletter', label: 'Next Newsletter' }
]

// app/page.tsx logic update

export default function Board() {
  const [activeTab, setActiveTab] = useState<Tab>('triage')
  const [events, setEvents] = useState<NewsletterEvent[]>(MOCK_EVENTS)
  const [selectedEvent, setSelectedEvent] = useState<NewsletterEvent | null>(null)
  const [openCol, setOpenCol] = useState<ListId | null>('review'); // Default to 'review' open

  // 1. Handlers
  const handleUpdateEvent = (updated: NewsletterEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
    setSelectedEvent(null) // Close form after save
  }

  const handleMoveEvent = (id: string, targetList: ListId) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, list_id: targetList } : e))
  }

  // 2. Determine which columns to show
  const currentColumns = activeTab === 'triage' ? TRIAGE_COLUMNS : NEWSLETTER_COLUMNS

  return (
    <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Tab Navigation */}
      <header className="bg-white border-b shadow-sm z-10">
        <h1 className="m-4 mb-2 text-2xl font-black text-slate-900 italic">The APP Desk</h1>
        <div className="flex px-4 gap-8">
          {(['triage', 'newsletter'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${
                activeTab === tab 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* The Board Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100">
        {currentColumns.map((col) => (
          <Column 
            key={col.id}
            col={col}
            isOpen={openCol === col.id}
            onToggle={() => setOpenCol(openCol === col.id ? null : col.id)}
            events={events.filter(e => e.list_id === col.id)}
            onDetails={setSelectedEvent}
            onMove={handleMoveEvent}
          />
        ))}
      </div>

      {/* Detail Overlay */}
      {selectedEvent && (
        <DetailsForm 
          event={selectedEvent} 
          onSave={handleUpdateEvent} 
          onClose={() => setSelectedEvent(null)}
          onMove={handleMoveEvent} // Optional: allow moving from inside the form
        />
      )}
    </main>
  )
}