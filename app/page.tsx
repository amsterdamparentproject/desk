'use client'
import { useState, useMemo, useEffect } from 'react'
import { Column } from './components/Column'
import { NewsletterEvent } from './types/event'
import { MOCK_EVENTS } from './mockData' // Replace with Supabase fetch later
import { CAPTURE_LISTS, NEWSLETTER_LISTS, TRIAGE_LISTS, ListId } from './types/list'
import { DetailsForm } from './components/DetailsForm'

type Tab = 'capture' |'triage' | 'newsletter'

export default function Board() {
  // Responsive default tab: capture on mobile, triage on desktop
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'capture' : 'triage'
    }
    return 'triage' // fallback for SSR
  })
  const [events, setEvents] = useState<NewsletterEvent[]>(MOCK_EVENTS)
  const [selectedEvent, setSelectedEvent] = useState<NewsletterEvent | null>(
    null
  )
  const [openCols, setOpenCols] = useState<Set<ListId>>(() => {
    // All columns expanded by default
    const allIds = [...CAPTURE_LISTS, ...TRIAGE_LISTS, ...NEWSLETTER_LISTS].map(col => col.id)
    return new Set(allIds)
  })

  // 1. Handlers
  const handleUpdateEvent = (updated: NewsletterEvent) => {
    setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setSelectedEvent(null) // Close form after save
  }

  const handleMoveEvent = (id: string, targetList: ListId) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, list_id: targetList } : e))
    )
  }

  const handleAddEvent = (event: NewsletterEvent) => {
    setEvents((prev) => [...prev, event])
  }

  // 2. Determine which columns to show
  const currentColumns = activeTab === 'capture' ? CAPTURE_LISTS : activeTab === 'triage' ? TRIAGE_LISTS : NEWSLETTER_LISTS

  return (
    <main className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Tab Navigation */}
      <header className="bg-white border-b shadow-sm z-10">
        <h1 className="m-4 mb-2 text-2xl font-black text-slate-900 italic">
          The APP Desk
        </h1>
        <div className="flex px-4 gap-8">
          {(['capture', 'triage', 'newsletter'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 text-sm font-black uppercase tracking-widest transition-all ${
                activeTab === tab
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* The Board Area */}
<div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
  {currentColumns.map((col) => (
    <div 
      key={col.id} 
      // w-full makes them stack on mobile
      // md:flex-1 md:basis-0 makes them 50/50 on desktop
      // min-w-0 prevents content from pushing the width out
      className="w-full md:flex-1 md:basis-0 min-w-0"
    >
      <Column
        list={col}
        isOpen={typeof window !== 'undefined' && window.innerWidth >= 768 ? true : openCols.has(col.id)}
        onToggle={() => {
          setOpenCols(prev => {
            const newSet = new Set(prev)
            if (newSet.has(col.id)) {
              newSet.delete(col.id)
            } else {
              newSet.add(col.id)
            }
            return newSet
          })
        }}
        events={events.filter((e) => e.list_id === col.id)}
        onDetails={setSelectedEvent}
        onMove={handleMoveEvent}
        onAddEvent={handleAddEvent}
      />
    </div>
  ))}
</div>

      {/* Detail Overlay */}
      {selectedEvent && (
        <DetailsForm
          event={selectedEvent}
          onSave={handleUpdateEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </main>
  )
}
