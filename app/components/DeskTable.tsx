'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Check,
  Loader2,
  Mail,
  Newspaper,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import type { CaptureDataProps, DeskActivity, Service } from '../types/activity'
import type { ListId } from '../types/list'
import { ParseNotice } from './card/ParseNotice'
import {
  filterRows,
  needsAttention,
  isPastEvent,
  sortRows,
  effectiveStart,
  type SortDir,
  type SortKey,
  type TypeFilter,
} from '@/lib/desk-table'

const TZ = 'Europe/Amsterdam'

// Same value on server and client (fixed zone), so rendering never mismatches.
const todayInAmsterdam = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())

const dayMonth = (isoDate: string) => {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

const addedLabel = (createdAt: string, today: string) => {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(
    new Date(createdAt)
  )
  if (day === today) return 'Today'
  const y = new Date(`${today}T00:00:00Z`)
  y.setUTCDate(y.getUTCDate() - 1)
  if (day === y.toISOString().slice(0, 10)) return 'Yesterday'
  return dayMonth(day)
}

type StageFilter = 'all' | 'next' | 'candidates'

interface DeskTableProps {
  // 'triage' = held rows + capture bar + Done refining.
  // 'newsletter' = refined rows tagged Newsletter, with "Next newsletter"
  // (list_id next_newsletter) highlighted and an Add to next / Remove action.
  mode?: 'triage' | 'newsletter'
  rows: DeskActivity[]
  onOpen: (activity: DeskActivity) => void
  onAdd?: (data: CaptureDataProps) => void
  onDoneRefining?: (id: string) => void
  onMoveList?: (id: string, target: ListId) => void
  onArchive: (id: string) => void
  onToggleService: (id: string, service: Service, enabled: boolean) => void
}

export function DeskTable({
  mode = 'triage',
  rows,
  onOpen,
  onAdd,
  onDoneRefining,
  onMoveList,
  onArchive,
  onToggleService,
}: DeskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(
    mode === 'newsletter' ? 'start' : 'created'
  )
  const [sortDir, setSortDir] = useState<SortDir>(
    mode === 'newsletter' ? 'asc' : 'desc'
  )
  const [stage, setStage] = useState<StageFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [query, setQuery] = useState('')
  const [onlyProblems, setOnlyProblems] = useState(false)
  // Set after mount so "just added" highlighting can't cause a hydration mismatch.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [])

  const today = todayInAmsterdam()
  const problemCount = rows.filter((a) => needsAttention(a, today)).length

  const nextCount = rows.filter((a) => a.list_id === 'next_newsletter').length

  const visible = useMemo(
    () =>
      sortRows(
        filterRows(
          rows.filter(
            (a) =>
              stage === 'all' ||
              (stage === 'next') === (a.list_id === 'next_newsletter')
          ),
          { type: typeFilter, query, onlyProblems, today }
        ),
        sortKey,
        sortDir
      ),
    [rows, stage, typeFilter, query, onlyProblems, today, sortKey, sortDir]
  )

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      // Newest first for "Added", soonest first for dates, A-Z for titles.
      setSortDir(key === 'created' ? 'desc' : 'asc')
    }
  }

  const counts = {
    all: rows.length,
    event: rows.filter((a) => a.type === 'event').length,
    resource: rows.filter((a) => a.type === 'resource').length,
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 p-2 md:p-4">
      <div className="mx-auto max-w-6xl space-y-3">
        {mode === 'triage' && onAdd && <CaptureBar onAdd={onAdd} />}

        {mode === 'newsletter' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50 px-3 py-2.5">
            <Newspaper size={16} className="text-blue-600" />
            <span className="text-sm font-black text-blue-900">
              Next newsletter
            </span>
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">
              {nextCount}
            </span>
            <span className="text-[11px] font-bold text-blue-700">
              {nextCount === 1 ? 'item' : 'items'} in the next issue
            </span>
            <div className="ml-auto inline-flex rounded-lg bg-white p-0.5 border border-blue-100">
              {(
                [
                  ['all', 'All'],
                  ['next', 'Next issue'],
                  ['candidates', 'Candidates'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStage(key)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wide transition-colors ${
                    stage === key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5">
            {(['all', 'event', 'resource'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wide transition-colors ${
                  typeFilter === t
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t === 'all' ? 'All' : t === 'event' ? 'Events' : 'Resources'}{' '}
                <span className="opacity-60">{counts[t]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <select
              aria-label="Sort by"
              value={sortKey}
              onChange={(e) => {
                const key = e.target.value as SortKey
                setSortKey(key)
                setSortDir(key === 'created' ? 'desc' : 'asc')
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-base font-bold text-slate-700"
            >
              <option value="created">Added</option>
              <option value="start">Date</option>
              <option value="title">Title</option>
            </select>
            <button
              type="button"
              aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="h-10 w-10 rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-700"
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          <label className="relative flex-1 min-w-[160px] max-w-xs">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, organiser, notes…"
              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-base md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </label>
          {problemCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyProblems((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
                onlyProblems
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <AlertTriangle size={13} /> Needs attention {problemCount}
            </button>
          )}
          <span className="ml-auto text-[11px] font-bold text-slate-400">
            {visible.length} {visible.length === 1 ? 'row' : 'rows'}
          </span>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_7.5rem_5.5rem_5rem_12rem] items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <span />
            <SortHeader
              label="Title"
              active={sortKey === 'title'}
              dir={sortDir}
              onClick={() => toggleSort('title')}
            />
            <span>Type</span>
            <SortHeader
              label="Date"
              active={sortKey === 'start'}
              dir={sortDir}
              onClick={() => toggleSort('start')}
            />
            <SortHeader
              label="Added"
              active={sortKey === 'created'}
              dir={sortDir}
              onClick={() => toggleSort('created')}
            />
            <span>Use for</span>
            <span className="text-right">Actions</span>
          </div>

          {visible.length === 0 ? (
            <div className="py-14 text-center text-[11px] italic tracking-wide text-slate-400">
              {rows.length === 0
                ? mode === 'newsletter'
                  ? 'Nothing refined for the newsletter yet. Use "Done refining" on Triage.'
                  : 'Nothing held yet. Capture something above 🌬️'
                : 'No rows match these filters'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((a) => (
                <Row
                  key={a.id}
                  activity={a}
                  today={today}
                  fresh={
                    now !== null &&
                    now - new Date(a.created_at).getTime() < 10 * 60 * 1000
                  }
                  onOpen={onOpen}
                  mode={mode}
                  onDoneRefining={onDoneRefining}
                  onMoveList={onMoveList}
                  onArchive={onArchive}
                  onToggleService={onToggleService}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 uppercase tracking-widest hover:text-slate-900 ${
        active ? 'text-slate-900' : ''
      }`}
    >
      {label}
      <Icon size={12} />
    </button>
  )
}

function Row({
  activity: a,
  today,
  fresh,
  onOpen,
  mode,
  onDoneRefining,
  onMoveList,
  onArchive,
  onToggleService,
}: {
  activity: DeskActivity
  today: string
  fresh: boolean
  onOpen: (a: DeskActivity) => void
  mode: 'triage' | 'newsletter'
  onDoneRefining?: (id: string) => void
  onMoveList?: (id: string, target: ListId) => void
  onArchive: (id: string) => void
  onToggleService: (id: string, service: Service, enabled: boolean) => void
}) {
  const processing = a.status === 'processing'
  const failed = a.list_id === 'error'
  const inNext = mode === 'newsletter' && a.list_id === 'next_newsletter'
  const past = isPastEvent(a, today)
  const start = effectiveStart(a, today)
  const services = a.services ?? []
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const dateText =
    a.type === 'resource'
      ? '—'
      : start
        ? a.end_date && a.end_date !== a.start_date && !a.repeat_rrule
          ? `${dayMonth(a.start_date ?? start)} – ${dayMonth(a.end_date)}`
          : dayMonth(start)
        : 'No date'

  return (
    <li
      onClick={() => onOpen(a)}
      className={`flex flex-wrap items-center gap-x-2 cursor-pointer px-3 py-2.5 transition-colors hover:bg-slate-50 md:grid md:grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_7.5rem_5.5rem_5rem_12rem] md:items-center md:gap-3 ${
        failed
          ? 'border-l-4 border-l-red-400'
          : inNext
            ? 'border-l-4 border-l-blue-500 bg-blue-50/70'
            : 'border-l-4 border-l-transparent'
      } ${fresh ? 'bg-amber-50/70' : ''}`}
    >
      {/* Thumbnail */}
      <div className="hidden md:block">
        {a.file_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.file_url}
            alt=""
            className="h-10 w-10 rounded-md object-cover bg-slate-100"
          />
        ) : (
          <div className="h-10 w-10 rounded-md bg-slate-100" />
        )}
      </div>

      {/* Title */}
      <div className="min-w-0 w-full md:w-auto">
        <div className="flex items-center gap-2">
          {processing && (
            <Loader2
              size={14}
              className="shrink-0 animate-spin text-amber-500"
              aria-label="Processing"
            />
          )}
          <span
            className={`truncate text-sm font-black tracking-tight ${
              processing ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {a.title || '(untitled)'}
          </span>
          {inNext && (
            <span className="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
              Next issue
            </span>
          )}
          {fresh && (
            <span className="shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
              New
            </span>
          )}
        </div>
        {(a.organization || a.neighborhood) && (
          <p className="truncate text-[11px] font-medium text-slate-500">
            {[a.organization, a.neighborhood].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-1 empty:hidden">
          <ParseNotice activity={a} compact />
        </div>
        {/* Mobile meta line */}
        <p className="mt-1 text-[11px] font-bold text-slate-500 md:hidden">
          {a.type === 'event' ? 'Event' : 'Resource'} · {dateText} · added{' '}
          {addedLabel(a.created_at, today)}
        </p>
      </div>

      {/* Type */}
      <div className="hidden md:block">
        <span
          className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
            a.type === 'event'
              ? 'bg-blue-50 text-blue-600'
              : 'bg-orange-50 text-orange-600'
          }`}
        >
          {a.type}
        </span>
      </div>

      {/* Date */}
      <div className="hidden md:flex items-center gap-1 text-xs font-bold">
        <span className={past ? 'text-red-500' : 'text-slate-700'}>
          {dateText}
        </span>
        {a.repeat_rrule && (
          <RefreshCw
            size={11}
            className="text-slate-400"
            aria-label="Repeats"
          />
        )}
        {past && (
          <span className="rounded bg-red-50 px-1 text-[9px] font-black uppercase text-red-500">
            Past
          </span>
        )}
      </div>

      {/* Added */}
      <div className="hidden md:block text-xs font-bold text-slate-500">
        {addedLabel(a.created_at, today)}
      </div>

      {/* Services */}
      <div
        className="mt-2 flex items-center gap-1.5 md:mt-0 md:gap-1"
        onClick={stop}
      >
        <ServiceButton
          on={services.includes('newsletter')}
          label="Newsletter"
          activeClass="bg-blue-600 text-white"
          onClick={() =>
            onToggleService(
              a.id,
              'newsletter',
              !services.includes('newsletter')
            )
          }
          icon={<Newspaper size={14} />}
        />
        {a.type === 'event' && (
          <ServiceButton
            on={services.includes('postpartum_post')}
            label="Post"
            activeClass="bg-violet-600 text-white"
            onClick={() =>
              onToggleService(
                a.id,
                'postpartum_post',
                !services.includes('postpartum_post')
              )
            }
            icon={<Mail size={14} />}
          />
        )}
      </div>

      {/* Actions */}
      <div
        className="mt-2 ml-auto flex items-center justify-end gap-1.5 md:mt-0 md:ml-0 md:gap-1"
        onClick={stop}
      >
        {mode === 'newsletter' &&
          onMoveList &&
          !processing &&
          (inNext || !past) && (
            <button
              type="button"
              onClick={() =>
                onMoveList(
                  a.id,
                  inNext
                    ? a.type === 'event'
                      ? 'upcoming_events'
                      : 'new_resources'
                    : 'next_newsletter'
                )
              }
              title={
                inNext
                  ? 'Take out of the next newsletter'
                  : 'Put in the next newsletter'
              }
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2.5 md:px-2.5 md:py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                inNext
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
              }`}
            >
              {inNext ? (
                <>
                  <X size={13} strokeWidth={3} /> Remove
                </>
              ) : (
                <>
                  <Check size={13} strokeWidth={3} /> Add to next
                </>
              )}
            </button>
          )}
        {mode === 'triage' &&
          onDoneRefining &&
          !processing &&
          !past &&
          services.length > 0 && (
            <button
              type="button"
              onClick={() => onDoneRefining(a.id)}
              title="Move to the Newsletter / Post tabs as refined"
              className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2.5 md:px-2.5 md:py-1.5 text-[11px] font-black uppercase tracking-wide text-green-700 transition-colors hover:bg-green-600 hover:text-white"
            >
              <Check size={13} strokeWidth={3} /> Done refining
            </button>
          )}
        {!processing && (
          <button
            type="button"
            onClick={() => onArchive(a.id)}
            title="Archive"
            aria-label="Archive"
            className="inline-flex items-center rounded-lg bg-red-50 p-2.5 md:p-2 text-red-600 transition-colors hover:bg-red-600 hover:text-white"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </li>
  )
}

function ServiceButton({
  on,
  label,
  activeClass,
  onClick,
  icon,
}: {
  on: boolean
  label: string
  activeClass: string
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        on ? `In ${label} — click to remove` : `Not in ${label} — click to add`
      }
      aria-pressed={on}
      className={`flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-lg transition-colors ${
        on
          ? activeClass
          : 'bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-400'
      }`}
    >
      {icon}
    </button>
  )
}

// One capture bar for both kinds. The AI decides event vs resource from what it
// finds anyway, and a row can be converted afterwards, so the toggle is only a
// starting guess.
function CaptureBar({ onAdd }: { onAdd: (data: CaptureDataProps) => void }) {
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<'event' | 'resource'>('event')
  const [useAi, setUseAi] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [description])

  const canSubmit = !!description.trim() || !!file
  const submit = () => {
    if (!canSubmit) return
    onAdd({ description, file, list_id: 'ideas', use_ai: useAi, type })
    setDescription('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    textRef.current?.focus()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="rounded-xl border-2 border-blue-200 bg-white p-3 shadow-sm focus-within:border-blue-400"
    >
      <textarea
        ref={textRef}
        value={description}
        rows={1}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        onPaste={(e) => {
          const img = Array.from(e.clipboardData.files).find((f) =>
            f.type.startsWith('image/')
          )
          if (img) {
            e.preventDefault()
            setFile(img)
          }
        }}
        placeholder="Paste a link, type a title, or drop in a flyer. Enter to add."
        className="w-full resize-none border-none p-1 text-base md:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
      {file && (
        <div className="mt-1 mb-1 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5">
          <span className="flex items-center gap-2 overflow-hidden text-[10px] font-bold uppercase tracking-tight text-blue-700">
            <Paperclip size={12} className="shrink-0 text-blue-500" />
            <span className="truncate">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remove attachment"
            className="text-blue-400 hover:text-blue-600"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-50 pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1.5 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <Paperclip size={14} />
            <span className="hidden text-[10px] font-black uppercase tracking-widest sm:inline">
              Attach
            </span>
          </button>
          <div className="inline-flex rounded-lg bg-slate-50 p-0.5">
            {(['event', 'resource'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  type === t
                    ? t === 'event'
                      ? 'bg-blue-600 text-white'
                      : 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setUseAi((v) => !v)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
              useAi
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              AI
            </span>
          </button>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Add"
          className="shrink-0 rounded-lg bg-blue-600 p-2.5 md:p-2 text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300"
        >
          <Send size={15} strokeWidth={3} />
        </button>
      </div>
    </form>
  )
}
