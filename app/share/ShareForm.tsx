'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles } from 'lucide-react'
import { captureFromShare } from '@/app/actions/activities'

interface ShareFormProps {
  initialDescription: string
  url: string
  title: string
}

export function ShareForm({ initialDescription, url, title }: ShareFormProps) {
  const router = useRouter()
  const [description, setDescription] = useState(initialDescription)
  const [type, setType] = useState<'event' | 'resource'>('event')
  const [useAi, setUseAi] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    setSubmitting(true)
    try {
      await captureFromShare({ title, description, url, type, use_ai: useAi })
      router.push('/')
    } catch (err) {
      console.error('Share capture failed:', err)
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
    >
      <textarea
        autoFocus
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Paste links, type titles, or add notes..."
        rows={4}
        className="w-full text-sm text-slate-800 border-none p-2 focus:ring-0 resize-none placeholder:text-slate-400"
      />

      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setUseAi(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              useAi ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Use AI</span>
          </button>

          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button
              type="button"
              onClick={() => setType('event')}
              className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                type === 'event' ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              Event
            </button>
            <button
              type="button"
              onClick={() => setType('resource')}
              className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                type === 'resource' ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              Resource
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={!description.trim() || submitting}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-md active:scale-95"
        >
          {submitting ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Send size={16} strokeWidth={3} />
          )}
        </button>
      </div>
    </form>
  )
}
