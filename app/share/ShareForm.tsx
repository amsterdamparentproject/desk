'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, CalendarDays, ImagePlus, X } from 'lucide-react'
import { LavaLamp, LavaSpinner } from '@/app/components/Lava'
import { GooToggle } from '@/app/components/GooToggle'
import { Pill } from '@/app/components/Pills'
import { randomAffirmation } from './affirmations'

type Bubble = { id: number; dx: number; dy: number; size: number; dur: number }
let burstId = 0

function makeBurst(count: number): Bubble[] {
  return Array.from({ length: count }, () => ({
    id: ++burstId,
    dx: Math.round((Math.random() - 0.5) * 260),
    dy: -Math.round(120 + Math.random() * 260),
    size: Math.round(8 + Math.random() * 22),
    dur: 1 + Math.random() * 0.9,
  }))
}

interface ShareFormProps {
  initialDescription: string
  url: string
  title: string
  initialFileUrl: string | null
  initialFileId: string | null
}

export function ShareForm({
  initialDescription,
  url,
  title,
  initialFileUrl,
  initialFileId,
}: ShareFormProps) {
  const router = useRouter()
  const [description, setDescription] = useState(initialDescription)
  const [type, setType] = useState<'event' | 'resource'>('event')
  const [useAi, setUseAi] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [caught, setCaught] = useState(false)
  const [affirmation, setAffirmation] = useState('')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  // After sending: keep the celebration up until the AI has finished the card.
  const [cardId, setCardId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'reading' | 'done' | 'failed'>('reading')

  // File already uploaded to Supabase by the POST share handler
  const [uploadedId, setUploadedId] = useState<string | null>(initialFileId)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(initialFileUrl)

  // File picked manually in the browser (uploaded on submit)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  // The URL to show in the preview — manual pick takes precedence
  const displayImageUrl = pendingPreviewUrl ?? uploadedUrl

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    // Replace any pre-uploaded file
    setUploadedId(null)
    setUploadedUrl(null)
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(selected)
    setPendingPreviewUrl(selected ? URL.createObjectURL(selected) : null)
  }

  const removeImage = () => {
    setUploadedId(null)
    setUploadedUrl(null)
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(null)
    setPendingPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canSubmit =
    (description.trim().length > 0 || displayImageUrl !== null) && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      let body: BodyInit
      let headers: HeadersInit | undefined

      if (pendingFile) {
        const fd = new FormData()
        fd.append('title', title)
        fd.append('description', description)
        fd.append('url', url)
        fd.append('type', type)
        fd.append('use_ai', String(useAi))
        if (uploadedId) fd.append('id', uploadedId)
        if (uploadedUrl) fd.append('file_url', uploadedUrl)
        fd.append('file', pendingFile)
        body = fd
      } else {
        body = JSON.stringify({
          title,
          description,
          url,
          type,
          use_ai: useAi,
          ...(uploadedId && uploadedUrl
            ? { id: uploadedId, file_url: uploadedUrl }
            : {}),
        })
        headers = { 'Content-Type': 'application/json' }
      }

      const res = await fetch('/api/share/submit', {
        method: 'POST',
        headers,
        body,
      })
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`)
      // Celebrate, then wait here until the AI has finished the card.
      const saved = (await res.json().catch(() => ({}))) as { id?: string }
      setCardId(saved.id ?? null)
      setPhase(useAi && saved.id ? 'reading' : 'done')
      setBubbles(makeBurst(22))
      setAffirmation(randomAffirmation())
      setCaught(true)
      navigator.vibrate?.([30, 40, 30])
    } catch (err) {
      console.error('Share capture failed:', err)
      setSubmitting(false)
    }
  }

  // Navigate, then ask the server for fresh data so the Desk never shows a
  // cached copy from before this capture.
  const goToDesk = useCallback(() => {
    router.push('/')
    router.refresh()
  }, [router])

  // Poll until the card leaves "processing" (give up after three minutes and
  // let the Desk's own stuck-card handling take over).
  useEffect(() => {
    if (!caught || phase !== 'reading' || !cardId) return
    let cancelled = false
    const startedAt = Date.now()
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/share/status?id=${encodeURIComponent(cardId)}`,
          { cache: 'no-store' }
        )
        const data = (await res.json()) as { status?: string; failed?: boolean }
        if (cancelled) return
        if (data.status && data.status !== 'processing') {
          setBubbles(makeBurst(14))
          navigator.vibrate?.(30)
          setPhase(data.failed ? 'failed' : 'done')
          return
        }
      } catch {
        // Network blip: keep waiting.
      }
      if (cancelled) return
      if (Date.now() - startedAt > 3 * 60 * 1000) {
        setPhase('done')
        return
      }
      timer = setTimeout(tick, 2000)
    }
    let timer = setTimeout(tick, 1500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [caught, phase, cardId])

  // Once the card is finished, linger a moment, then head to the Desk.
  useEffect(() => {
    if (!caught || phase === 'reading') return
    const t = setTimeout(goToDesk, phase === 'failed' ? 4500 : 2600)
    return () => clearTimeout(t)
  }, [caught, phase, goToDesk])

  if (caught) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex items-center justify-center bg-base p-4"
      >
        <div className="relative flex w-full max-w-md flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl bg-lamp-glow/90 p-8 text-center text-ink">
          <div className="relative flex flex-col items-center">
            <LavaLamp
              width={130}
              height={270}
              glow="#ed45df"
              glowOpacity={1}
              outline="#1d1a1b"
              strokeWidth={4}
              label="Caught"
            />
            {bubbles.map((b) => (
              <span
                key={b.id}
                aria-hidden="true"
                className="bubble-burst pointer-events-none absolute left-1/2 top-24 rounded-full bg-amber-300"
                style={
                  {
                    width: b.size,
                    height: b.size,
                    marginLeft: -b.size / 2,
                    '--dx': `${b.dx}px`,
                    '--dy': `${b.dy}px`,
                    '--dur': `${b.dur}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <p className="font-display text-xl font-extrabold">Caught it!</p>
          <p className="reveal max-w-xs text-sm font-semibold leading-relaxed">
            {affirmation}
          </p>
          <div className="flex min-h-6 items-center gap-2 text-xs font-black uppercase tracking-widest">
            {phase === 'reading' ? (
              <>
                <LavaSpinner
                  color="#1d1a1b"
                  width={44}
                  height={22}
                  label="Reading"
                />
                Reading it now
              </>
            ) : phase === 'failed' ? (
              'The AI hit a snag. It is in your inbox with a note.'
            ) : (
              'All done. Opening the Desk…'
            )}
          </div>
          <button
            type="button"
            onClick={goToDesk}
            className="rounded-xl border-2 border-ink px-4 py-2 text-xs font-black uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-lamp-glow"
          >
            Open the Desk
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border-2 border-slate-200 bg-surface p-3 transition-shadow focus-within:border-violet-400 focus-within:shadow-[0_0_24px_rgba(227,45,212,0.35)]">
        <textarea
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you find? Paste links, names, dates…"
          rows={5}
          className="w-full resize-none border-none bg-transparent p-2 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />

        {displayImageUrl && (
          <div className="relative mx-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob/object URL preview can't use next/image */}
            <img
              src={displayImageUrl}
              alt="Selected image"
              className="max-h-56 w-full rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              aria-label="Remove image"
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`mx-1 mb-1 flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
            displayImageUrl
              ? 'border-blue-400 text-blue-300'
              : 'border-slate-200 text-slate-500 hover:border-blue-400 hover:text-blue-300'
          }`}
        >
          <ImagePlus size={16} />
          {displayImageUrl ? 'Swap image' : 'Add image'}
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label="What is it?"
        className="grid grid-cols-2 gap-3"
      >
        <Pill
          role="radio"
          color="blue"
          size="lg"
          index={0}
          active={type === 'event'}
          onClick={() => setType('event')}
        >
          <span className="flex items-center justify-center gap-2 py-1.5">
            <CalendarDays size={20} strokeWidth={2.4} />
            Event
          </span>
        </Pill>
        <Pill
          role="radio"
          color="magenta"
          size="lg"
          index={1}
          active={type === 'resource'}
          onClick={() => setType('resource')}
        >
          <span className="flex items-center justify-center gap-2 py-1.5">
            <BookOpen size={20} strokeWidth={2.4} />
            Resource
          </span>
        </Pill>
      </div>

      <GooToggle
        checked={useAi}
        onChange={setUseAi}
        onLabel="Use AI"
        offLabel="No AI"
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-app-gold bg-app-gold px-6 py-4 font-display text-lg font-extrabold text-ink shadow-[4px_4px_0_rgba(227,45,212,0.9)] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none motion-reduce:transition-none"
      >
        {submitting ? (
          <LavaSpinner color="#1d1a1b" width={44} height={22} label="Sending" />
        ) : (
          'Capture it'
        )}
      </button>
    </form>
  )
}
