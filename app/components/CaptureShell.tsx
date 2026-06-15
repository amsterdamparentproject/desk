'use client'

import { useRouter } from 'next/navigation'
import { CaptureCardForm } from './card/CaptureCardForm'
import { TRIAGE_LISTS } from '@/app/types/list'
import type { CaptureDataProps } from '@/app/types/activity'

// Shown via Suspense while BoardWithData fetches from Supabase.
// Renders the Ideas capture form immediately so the user can start typing right away.
// Submissions go directly to captureFromShare; router.refresh() then loads
// the real Board with the new activity already in it.
export function CaptureShell() {
  const router = useRouter()

  const handleAdd = (data: CaptureDataProps) => {
    fetch('/api/share/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', description: data.description, url: '', type: data.type, use_ai: data.use_ai }),
    })
      .then(() => router.refresh())
      .catch(err => {
        console.error('CaptureShell submit failed:', err)
        router.refresh()
      })
  }

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      {/* Matches Board's header exactly */}
      <header className="bg-white border-b border-slate-200 z-10">
        <div className="flex px-4 gap-8 items-center justify-between">
          <div className="flex gap-8">
            <span className="py-4 text-xs sm:text-sm font-black uppercase tracking-widest text-blue-600">
              Triage
            </span>
            <span className="py-4 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-400">
              Newsletter
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
        {TRIAGE_LISTS.map((col) => (
          <div key={col.id} className="w-full md:flex-1 md:basis-0 min-w-0">
            <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
              {/* Column header — matches Column.tsx open state */}
              <div className="w-full flex items-center justify-between p-4 bg-blue-600 text-white">
                <h2 className="font-black text-xs uppercase tracking-tighter">{col.label}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">0</span>
              </div>

              <div className="p-3 space-y-3 bg-slate-100 md:bg-transparent">
                {col.id === 'ideas' ? (
                  <div className="sticky top-0 z-10 mb-2 bg-slate-100 md:bg-white/80 md:backdrop-blur-sm">
                    <CaptureCardForm onAdd={handleAdd} listId="ideas" />
                  </div>
                ) : (
                  // Skeleton cards for review / error columns
                  [1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-slate-200 h-24 animate-pulse"
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        ))}
      </div>
    </main>
  )
}
