'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  BookOpen,
  CalendarDays,
  Check,
  Mail,
  Newspaper,
  Paperclip,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { addDays } from '@/lib/issue-date'
import { GooPill, LavaSpinner } from './Lava'
import { AREA_FIRST, AREA_LAST, AREA_PENULTIMATE } from './NewsletterDrawer'
import { formatOccurrenceDates } from '@/lib/occurrences'
import type { CaptureDataProps, DeskActivity, Service } from '../types/activity'
import { ParseNotice } from './card/ParseNotice'
import {
  filterRows,
  needsAttention,
  isPastEvent,
  sortRows,
  effectiveStart,
  matchMonthEnd,
  postGroup,
  doneGroup,
  inIssueWindow,
  type DoneGroup,
  type PostGroup,
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

type StageFilter = 'all' | 'potential' | 'selected' | PostGroup | DoneGroup

interface DeskTableProps {
  // 'triage' = held rows + capture bar + Done refining.
  // 'newsletter' = refined rows tagged Newsletter, with "Next newsletter"
  // (in_next_issue) highlighted and an Add to next / Remove action.
  // 'post' = refined events tagged Post, grouped This match / Future match /
  // Recurring.
  mode?: 'triage' | 'newsletter' | 'post' | 'done'
  // Newsletter mode: publish date of the next issue; the issue covers the
  // following two weeks.
  issueDate?: string
  rows: DeskActivity[]
  onOpen: (activity: DeskActivity) => void
  onAdd?: (data: CaptureDataProps) => void
  onDoneRefining?: (id: string) => void
  onToggleNextIssue?: (id: string, inNext: boolean) => void
  onRestore?: (id: string) => void
  onDelete?: (id: string, type: 'event' | 'resource') => void
  onArchive: (id: string) => void
  onToggleService: (id: string, service: Service, enabled: boolean) => void
}

export function DeskTable({
  mode = 'triage',
  issueDate,
  rows,
  onOpen,
  onAdd,
  onDoneRefining,
  onToggleNextIssue,
  onRestore,
  onDelete,
  onArchive,
  onToggleService,
}: DeskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(
    mode === 'triage' ? 'created' : 'start'
  )
  const [sortDir, setSortDir] = useState<SortDir>(
    mode === 'triage' ? 'desc' : 'asc'
  )
  const [stage, setStage] = useState<StageFilter>(
    mode === 'newsletter' && issueDate ? 'potential' : 'all'
  )
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

  const nextCount = rows.filter((a) => a.in_next_issue).length
  const windowEnd = issueDate ? addDays(issueDate, 14) : null
  // Potential = refined for the newsletter, happening in the issue window, and
  // not yet selected.
  const isPotential = useCallback(
    (a: DeskActivity) =>
      !a.in_next_issue &&
      !isPastEvent(a, today) &&
      a.status !== 'processing' &&
      a.status !== 'failed' &&
      (!issueDate ||
        !windowEnd ||
        inIssueWindow(a, issueDate, windowEnd, today)),
    [issueDate, windowEnd, today]
  )
  const potentialCount = rows.filter(isPotential).length
  const monthEnd = matchMonthEnd()
  const postCounts = {
    this: rows.filter((a) => postGroup(a, monthEnd) === 'this').length,
    future: rows.filter((a) => postGroup(a, monthEnd) === 'future').length,
    recurring: rows.filter((a) => postGroup(a, monthEnd) === 'recurring')
      .length,
  }
  const doneCounts = {
    published: rows.filter((a) => doneGroup(a) === 'published').length,
    archived: rows.filter((a) => doneGroup(a) === 'archived').length,
  }

  const visible = useMemo(
    () =>
      sortRows(
        filterRows(
          rows.filter((a) => {
            if (stage === 'all') return true
            if (mode === 'post') return postGroup(a, monthEnd) === stage
            if (mode === 'done') return doneGroup(a) === stage
            if (stage === 'selected') return a.in_next_issue
            if (stage === 'potential') return isPotential(a)
            return true
          }),
          { type: typeFilter, query, onlyProblems, today }
        ),
        sortKey,
        sortDir,
        mode === 'newsletter' ? issueDate : undefined
      ),
    [
      rows,
      stage,
      mode,
      monthEnd,
      isPotential,
      typeFilter,
      query,
      onlyProblems,
      today,
      sortKey,
      sortDir,
      issueDate,
    ]
  )

  // "Selected" on the Newsletter tab mirrors the issue itself: rows split by
  // area, highlights first, Everywhere and Online last. The chosen sort still
  // orders the rows inside each area.
  const groups = useMemo(() => {
    if (mode !== 'newsletter' || stage !== 'selected') return null
    const byArea: Record<string, typeof visible> = { [AREA_FIRST]: [] }
    for (const a of visible) {
      const area = a.area || 'Other'
      const key = a.newsletter_highlight ? AREA_FIRST : area
      ;(byArea[key] ??= []).push(a)
    }
    const middle = Object.keys(byArea).filter(
      (k) => k !== AREA_FIRST && k !== AREA_PENULTIMATE && k !== AREA_LAST
    )
    return [AREA_FIRST, ...middle, AREA_PENULTIMATE, AREA_LAST]
      .filter((k) => byArea[k]?.length)
      .map((k) => [k, byArea[k]] as const)
  }, [mode, stage, visible])

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
            <GooPill
              label="Next newsletter"
              count={nextCount}
              color="#449dd1"
              tilt={-1.5}
            />
            <span className="text-[11px] font-bold text-blue-300">
              {nextCount === 1 ? 'item' : 'items'} selected
              {issueDate ? ` for ${issueDate}` : ''}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="inline-flex gap-1.5">
                {(
                  [
                    ['potential', 'Potential', potentialCount],
                    ['selected', 'Selected', nextCount],
                  ] as const
                ).map(([key, label, n]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStage(stage === key ? 'all' : key)}
                    className={`px-3.5 py-1.5 rounded-full border-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      stage === key
                        ? 'border-blue-400 bg-blue-400 text-ink shadow-[0_0_14px_rgba(68,157,209,0.45)]'
                        : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-white'
                    }`}
                  >
                    {label} <span className="opacity-60">{n}</span>
                  </button>
                ))}
              </div>
              {stage !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStage('all')}
                  title="Clear the filter and show every refined newsletter item"
                  aria-label="Clear filter"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-blue-100 text-slate-500 hover:bg-app-gold hover:text-ink transition-colors"
                >
                  <X size={14} strokeWidth={3} />
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'post' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-3 py-2.5">
            <GooPill
              label="Postpartum Post"
              count={rows.length}
              color="#ed45df"
              blob="#ffbf00"
              tilt={1.2}
            />
            <span className="text-[11px] font-bold text-violet-300">
              {rows.length === 1 ? 'event' : 'events'} available for matching
            </span>
            <div className="ml-auto inline-flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All', rows.length],
                  ['this', 'This match', postCounts.this],
                  ['future', 'Future match', postCounts.future],
                  ['recurring', 'Recurring', postCounts.recurring],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStage(key)}
                  className={`px-3.5 py-1.5 rounded-full border-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    stage === key
                      ? 'border-violet-400 bg-violet-400 text-ink shadow-[0_0_14px_rgba(237,69,223,0.45)]'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-white'
                  }`}
                >
                  {label} <span className="opacity-60">{n}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'done' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-slate-200 bg-surface px-3 py-2.5">
            <GooPill
              label="Done"
              count={rows.length}
              color="#09bc8a"
              tilt={-1}
            />
            <div className="ml-auto inline-flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All', rows.length],
                  ['published', 'Published', doneCounts.published],
                  ['archived', 'Archived', doneCounts.archived],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStage(key)}
                  className={`px-3.5 py-1.5 rounded-full border-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    stage === key
                      ? 'border-app-gold bg-app-gold text-ink shadow-[0_0_14px_rgba(255,191,0,0.45)]'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-white'
                  }`}
                >
                  {label} <span className="opacity-60">{n}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1.5">
            {(['all', 'event', 'resource'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3.5 py-1.5 rounded-full border-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  typeFilter === t
                    ? 'border-app-gold bg-app-gold text-ink shadow-[0_0_14px_rgba(255,191,0,0.45)]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All' : t === 'event' ? 'Events' : 'Resources'}{' '}
                <span className="opacity-60">{counts[t]}</span>
              </button>
            ))}
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
              className="w-full rounded-xl border-2 border-slate-200 bg-base pl-8 pr-3 py-2 text-base md:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
            />
          </label>
          {problemCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyProblems((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide transition-colors ${
                onlyProblems
                  ? 'border-red-500 bg-red-600 text-white shadow-[0_0_16px_rgba(255,59,79,0.45)]'
                  : 'border-red-500/50 bg-red-50 text-red-300 hover:bg-red-100'
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
        <div className="rounded-2xl border-2 border-slate-200 bg-surface overflow-hidden">
          <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 md:hidden">
            <span className="text-slate-400">Sort</span>
            <SortHeader
              label="Title"
              active={sortKey === 'title'}
              dir={sortDir}
              onClick={() => toggleSort('title')}
            />
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
          </div>
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
            <span>{mode === 'done' ? 'Status' : 'Use for'}</span>
            <span className="text-right">Actions</span>
          </div>

          {visible.length === 0 ? (
            <div className="py-14 text-center text-[11px] italic tracking-wide text-slate-400">
              {rows.length === 0
                ? mode === 'newsletter'
                  ? 'Nothing refined for the newsletter yet. Use "Done refining" on Triage.'
                  : mode === 'post'
                    ? 'No refined events tagged Post yet. Use "Done refining" on Triage.'
                    : mode === 'done'
                      ? 'Nothing done yet.'
                      : 'Nothing held yet. Capture something above 🌬️'
                : 'No rows match these filters'}
            </div>
          ) : groups ? (
            <div className="space-y-4 p-2">
              {groups.map(([area, items], gi) => (
                <section key={area}>
                  <div className="px-1 pb-2">
                    <GooPill
                      label={area}
                      count={items.length}
                      color={area === AREA_FIRST ? '#ffbf00' : '#449dd1'}
                      blob="#e32dd4"
                      tilt={gi % 2 === 0 ? -1.5 : 1.2}
                    />
                  </div>
                  <ul className="space-y-2">
                    {items.map((a) => (
                      <Row
                        key={a.id}
                        activity={a}
                        today={today}
                        fresh={
                          now !== null &&
                          now - new Date(a.created_at).getTime() <
                            10 * 60 * 1000
                        }
                        onOpen={onOpen}
                        mode={mode}
                        potential={isPotential(a)}
                        selectedView={stage === 'selected'}
                        issueDate={issueDate}
                        onDoneRefining={onDoneRefining}
                        onToggleNextIssue={onToggleNextIssue}
                        onRestore={onRestore}
                        onDelete={onDelete}
                        onArchive={onArchive}
                        onToggleService={onToggleService}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="space-y-2 p-2">
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
                  potential={isPotential(a)}
                  selectedView={stage === 'selected'}
                  issueDate={issueDate}
                  onDoneRefining={onDoneRefining}
                  onToggleNextIssue={onToggleNextIssue}
                  onRestore={onRestore}
                  onDelete={onDelete}
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
  potential,
  selectedView,
  issueDate,
  onDoneRefining,
  onToggleNextIssue,
  onRestore,
  onDelete,
  onArchive,
  onToggleService,
}: {
  activity: DeskActivity
  today: string
  fresh: boolean
  onOpen: (a: DeskActivity) => void
  mode: 'triage' | 'newsletter' | 'post' | 'done'
  potential?: boolean
  /** Every row is selected here, so skip the per-row selected outline. */
  selectedView?: boolean
  issueDate?: string
  onRestore?: (id: string) => void
  onDelete?: (id: string, type: 'event' | 'resource') => void
  onDoneRefining?: (id: string) => void
  onToggleNextIssue?: (id: string, inNext: boolean) => void
  onArchive: (id: string) => void
  onToggleService: (id: string, service: Service, enabled: boolean) => void
}) {
  const processing = a.status === 'processing'
  const failed = a.status === 'failed'
  const inNext = mode === 'newsletter' && a.in_next_issue
  // Newsletter rows that could still be added to the next issue.
  const eligible = mode === 'newsletter' && potential
  const past = isPastEvent(a, today)
  const start = effectiveStart(
    a,
    today,
    mode === 'newsletter' ? issueDate : undefined
  )
  const services = a.services ?? []
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const group = doneGroup(a)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dateText =
    a.type === 'resource'
      ? '—'
      : (a.occurrences?.length ?? 0) > 1
        ? formatOccurrenceDates(a.occurrences!)
        : start
          ? a.end_date && a.end_date !== a.start_date && !a.repeat_rrule
            ? `${dayMonth(a.start_date ?? start)} – ${dayMonth(a.end_date)}`
            : dayMonth(start)
          : 'No date'

  return (
    <li
      onClick={() => onOpen(a)}
      className={`flex flex-wrap items-center gap-x-2 cursor-pointer rounded-2xl border-2 px-3 py-2.5 transition-colors hover:bg-slate-100 md:grid md:grid-cols-[2.5rem_minmax(0,1fr)_5.5rem_7.5rem_5.5rem_5rem_12rem] md:items-center md:gap-3 ${
        failed
          ? 'border-red-500 shadow-[0_0_22px_rgba(255,59,79,0.2)]'
          : processing
            ? 'border-app-gold shadow-[0_0_22px_rgba(255,191,0,0.2)]'
            : inNext && !selectedView
              ? 'border-app-gold shadow-[0_0_18px_rgba(255,191,0,0.25)]'
              : 'border-slate-200'
      } ${fresh && !failed && !processing ? 'bg-amber-50/70' : ''}`}
    >
      {/* Thumbnail */}
      <div className="hidden md:block">
        {a.file_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.file_url}
            alt=""
            className={`h-10 w-10 rounded-md object-cover bg-slate-100 ${inNext ? 'ring-2 ring-app-gold' : eligible ? 'ring-2 ring-green-400' : ''}`}
          />
        ) : (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-ink ${
              inNext
                ? 'bg-app-gold shadow-[0_0_14px_rgba(255,191,0,0.55)]'
                : eligible
                  ? 'bg-green-400 shadow-[0_0_14px_rgba(74,222,128,0.5)]'
                  : a.type === 'event'
                    ? 'bg-blue-400 shadow-[0_0_14px_rgba(68,157,209,0.45)]'
                    : 'bg-violet-500 shadow-[0_0_14px_rgba(227,45,212,0.45)]'
            }`}
            title={`${a.type === 'event' ? 'Event' : 'Resource'}${eligible ? ' — can go in the next issue' : ''}`}
          >
            {a.type === 'event' ? (
              <CalendarDays size={22} strokeWidth={2.4} aria-label="Event" />
            ) : (
              <BookOpen size={22} strokeWidth={2.4} aria-label="Resource" />
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="min-w-0 w-full md:w-auto">
        <div className="flex items-center gap-2">
          {processing && (
            <LavaSpinner width={34} height={17} label="Processing" />
          )}
          <span
            className={`truncate text-sm font-black tracking-tight ${
              processing ? 'text-slate-400' : 'text-slate-900'
            }`}
          >
            {a.title || '(untitled)'}
          </span>
          {inNext && (
            <span className="shrink-0 rounded-full bg-app-gold px-1.5 py-0.5 text-[9px] font-black uppercase text-ink">
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
              ? 'bg-blue-50 text-blue-300'
              : 'bg-violet-50 text-violet-300'
          }`}
        >
          {a.type}
        </span>
      </div>

      {/* Date */}
      <div className="hidden md:flex items-center gap-1 text-xs font-bold">
        <span className={past ? 'text-red-300' : 'text-slate-700'}>
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
          <span className="rounded bg-red-50 px-1 text-[9px] font-black uppercase text-red-300">
            Past
          </span>
        )}
      </div>

      {/* Added */}
      <div className="hidden md:block text-xs font-bold text-slate-500">
        {addedLabel(a.created_at, today)}
      </div>

      {/* Services / Status */}
      {mode === 'done' ? (
        <div className="mt-2 md:mt-0">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
              group === 'published'
                ? 'bg-green-50 text-green-300'
                : 'bg-red-50 text-red-300'
            }`}
            title={
              group === 'published' && a.newsletter_last
                ? `Sent in the ${a.newsletter_last} issue`
                : undefined
            }
          >
            {group === 'published' && a.newsletter_last
              ? `Sent ${dayMonth(a.newsletter_last)}`
              : group}
          </span>
        </div>
      ) : (
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
      )}

      {/* Actions */}
      <div
        className="mt-2 ml-auto flex items-center justify-end gap-1.5 md:mt-0 md:ml-0 md:gap-1"
        onClick={stop}
      >
        {mode === 'newsletter' &&
          onToggleNextIssue &&
          !processing &&
          (inNext || !past) && (
            <button
              type="button"
              onClick={() => onToggleNextIssue(a.id, !inNext)}
              title={
                inNext
                  ? 'Take out of the next newsletter'
                  : 'Put in the next newsletter'
              }
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2.5 md:px-2.5 md:py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                inNext
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-600 hover:text-white'
                  : 'bg-blue-50 text-blue-300 hover:bg-blue-600 hover:text-white'
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
              className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-2.5 md:px-2.5 md:py-1.5 text-[11px] font-black uppercase tracking-wide text-green-300 transition-colors hover:bg-green-600 hover:text-white"
            >
              <Check size={13} strokeWidth={3} /> Done refining
            </button>
          )}
        {mode === 'done' && onRestore && a.list_id === 'done' && (
          <button
            type="button"
            onClick={() => onRestore(a.id)}
            title="Restore to the inbox"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2.5 md:px-2.5 md:py-1.5 text-[11px] font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <Undo2 size={13} strokeWidth={3} /> Restore
          </button>
        )}
        {mode === 'done' && onDelete && a.list_id === 'done' && (
          <button
            type="button"
            onClick={() => {
              if (confirmDelete) onDelete(a.id, a.type)
              else setConfirmDelete(true)
            }}
            onBlur={() => setConfirmDelete(false)}
            title="Delete permanently"
            aria-label="Delete permanently"
            className={`inline-flex items-center gap-1 rounded-lg p-2.5 md:p-2 text-[11px] font-black uppercase transition-colors ${
              confirmDelete
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-300 hover:bg-red-600 hover:text-white'
            }`}
          >
            <Trash2 size={13} />
            {confirmDelete && 'Confirm'}
          </button>
        )}
        {!processing && (mode !== 'done' || a.list_id !== 'done') && (
          <button
            type="button"
            onClick={() => onArchive(a.id)}
            title="Archive"
            aria-label="Archive"
            className="inline-flex items-center rounded-lg bg-red-50 p-2.5 md:p-2 text-red-300 transition-colors hover:bg-red-600 hover:text-white"
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
    onAdd({ description, file, list_id: 'inbox', use_ai: useAi, type })
    setDescription('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    textRef.current?.focus()
  }

  const ringClass = useAi
    ? 'border-lamp-glow shadow-[0_0_0_5px_rgba(227,45,212,0.13),0_0_52px_rgba(227,45,212,0.33)] focus-within:border-lamp-glow'
    : 'border-slate-400 focus-within:border-slate-300'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className={`rounded-[28px] border-[3px] bg-surface p-4 md:p-5 transition-all ${ringClass}`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="font-display text-base font-extrabold text-white">
          Capture
        </span>
        <span className="hidden font-mono text-xs text-slate-500 sm:inline">
          What did you find?
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={useAi}
          aria-label="Use AI to read this"
          onClick={() => setUseAi((v) => !v)}
          className="ml-auto flex items-center gap-2.5"
        >
          <span
            className={`font-mono text-xs font-medium uppercase tracking-[0.12em] ${
              useAi ? 'text-violet-500' : 'text-slate-500'
            }`}
          >
            AI {useAi ? 'on' : 'off'}
          </span>
          <span
            className={`relative h-[30px] w-[62px] rounded-full border-[3px] transition-colors ${
              useAi ? 'border-white bg-lamp-glow' : 'border-slate-300 bg-base'
            }`}
          >
            <span
              className={`absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full transition-all ${
                useAi ? 'left-[34px] bg-app-gold' : 'left-[4px] bg-slate-300'
              }`}
            />
          </span>
        </button>
      </div>
      <textarea
        ref={textRef}
        value={description}
        rows={2}
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
        className="w-full resize-none rounded-2xl border-2 border-slate-200 bg-base px-4 py-3 text-base font-medium text-white placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
      />
      {file && (
        <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-100 px-3 py-1.5">
          <span className="flex items-center gap-2 overflow-hidden font-mono text-xs text-white">
            <Paperclip size={12} className="shrink-0 text-slate-500" />
            <span className="truncate">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remove attachment"
            className="text-slate-500 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border-2 border-slate-200 px-3 py-2 text-white transition-colors hover:border-slate-400"
          >
            <Paperclip size={14} />
            <span className="hidden font-display text-[10px] font-bold uppercase tracking-wider sm:inline">
              Attach
            </span>
          </button>
          <div className="inline-flex rounded-xl border-2 border-slate-200 bg-base p-0.5">
            {(['event', 'resource'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-lg px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  type === t
                    ? t === 'event'
                      ? 'bg-blue-400 text-ink'
                      : 'bg-violet-500 text-ink'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`shrink-0 rounded-2xl px-5 py-3 md:px-9 md:py-4 font-display text-sm font-extrabold transition-all active:scale-95 disabled:opacity-40 ${
            useAi
              ? 'bg-lamp-glow text-ink shadow-[0_0_34px_rgba(227,45,212,0.6)] hover:brightness-110'
              : 'border-2 border-white text-white hover:bg-slate-100'
          }`}
        >
          {useAi ? (
            <span className="inline-flex items-center gap-2">
              <Sparkles size={16} /> Capture with AI
            </span>
          ) : (
            'Add as typed'
          )}
        </button>
      </div>
    </form>
  )
}
