'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { Paperclip, X, Send, Sparkles } from 'lucide-react'
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
            <span className="py-4 text-xs sm:text-sm font-black uppercase tracking-widest text-orange-500">
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
                    <ShareCaptureForm onAdd={handleAdd} />
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

const TYPE_STYLES = {
  event:    { border: 'border-blue-200',   label: 'text-blue-500',   btn: 'bg-blue-600 hover:bg-blue-700',   ai: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
  resource: { border: 'border-orange-200', label: 'text-orange-500', btn: 'bg-orange-500 hover:bg-orange-600', ai: 'bg-orange-50 text-orange-600 hover:bg-orange-100' },
}

function ShareCaptureForm({ onAdd }: { onAdd: (data: CaptureDataProps) => void }) {
  const [type, setType] = useState<'event' | 'resource'>('event')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [useAi, setUseAi] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [description])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() && !file) return
    onAdd({ description, file, list_id: 'ideas', use_ai: useAi, type })
    setDescription('')
    setFile(null)
  }

  const s = TYPE_STYLES[type]

  return (
    <form onSubmit={handleSubmit} className={`bg-white border-2 ${s.border} rounded-xl p-3 shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[10px] font-black uppercase tracking-widest ${s.label}`}>{type}</p>
        <div className="flex rounded-lg overflow-hidden border border-slate-200">
          <button type="button" onClick={() => setType('event')}
            className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${type === 'event' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
            Event
          </button>
          <button type="button" onClick={() => setType('resource')}
            className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${type === 'resource' ? 'bg-orange-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
            Resource
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        autoFocus
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Paste links, type titles, or add notes..."
        className="w-full text-sm text-slate-800 border-none p-2 focus:ring-0 resize-none min-h-[60px] max-h-[500px] placeholder:text-slate-400"
      />

      {file && (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip size={12} className="text-slate-400 shrink-0" />
            <span className="text-[10px] font-bold text-slate-600 truncate uppercase tracking-tight">{file.name}</span>
          </div>
          <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-50 pt-2 gap-2">
        <div className="flex items-center gap-1.5">
          <input type="file" ref={fileInputRef} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">
            <Paperclip size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Attach</span>
          </button>
          <button type="button" onClick={() => setUseAi(v => !v)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${useAi ? s.ai : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            <Sparkles size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">AI</span>
          </button>
        </div>
        <button type="submit" disabled={!description.trim() && !file}
          className={`text-white p-2 rounded-lg disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-sm active:scale-95 shrink-0 ${s.btn}`}>
          <Send size={15} strokeWidth={3} />
        </button>
      </div>
    </form>
  )
}
