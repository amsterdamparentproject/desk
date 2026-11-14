'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, X } from 'lucide-react'
import type { Occurrence } from '@/lib/occurrences'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

const label = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

// Pick any set of dates on a calendar and give each its own start/end time.
// Click a day to add it (it copies the times of the day before it, which is
// usually what you want) or click it again to remove it.
export function OccurrencePicker({
  value,
  onChange,
}: {
  value: Occurrence[]
  // commit = true for discrete actions (add/remove a day), false while typing
  // a time; the caller saves on commit, and on blur for typed changes.
  onChange: (next: Occurrence[], commit: boolean) => void
}) {
  const first = value[0]?.date ?? new Date().toLocaleDateString('en-CA')
  const [view, setView] = useState(() => ({
    y: Number(first.slice(0, 4)),
    m: Number(first.slice(5, 7)) - 1,
  }))

  const selected = new Set(value.map((o) => o.date))
  const today = new Date().toLocaleDateString('en-CA')

  // Monday-first grid with leading blanks.
  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  const toggle = (date: string) => {
    if (selected.has(date)) {
      onChange(
        value.filter((o) => o.date !== date),
        true
      )
      return
    }
    const before = [...value].reverse().find((o) => o.date < date)
    const template = before ?? value[0]
    const added: Occurrence = {
      date,
      start_time: template?.start_time ?? null,
      end_time: template?.end_time ?? null,
    }
    onChange(
      [...value, added].sort((a, b) => a.date.localeCompare(b.date)),
      true
    )
  }

  const setTime = (
    date: string,
    field: 'start_time' | 'end_time',
    time: string
  ) =>
    onChange(
      value.map((o) => (o.date === date ? { ...o, [field]: time || null } : o)),
      false
    )

  const copyFirstToAll = () => {
    const f = value[0]
    if (!f) return
    onChange(
      value.map((o) => ({
        ...o,
        start_time: f.start_time,
        end_time: f.end_time,
      })),
      true
    )
  }

  const timeStyle =
    'w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white'

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-black text-slate-700">
            {MONTH_NAMES[view.m]} {view.y}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d) => (
            <span
              key={d}
              className="text-[9px] font-black uppercase tracking-widest text-slate-400"
            >
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`b${i}`} />
            const date = iso(view.y, view.m, day)
            const on = selected.has(date)
            return (
              <button
                key={date}
                type="button"
                onClick={() => toggle(date)}
                aria-pressed={on}
                aria-label={label(date)}
                className={`h-9 rounded-lg text-sm font-bold transition-colors ${
                  on
                    ? 'bg-blue-600 text-white'
                    : date === today
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>

      {value.length === 0 ? (
        <p className="text-xs italic text-slate-400">
          Click days on the calendar to add them.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-green-600">
              {value.length} {value.length === 1 ? 'date' : 'dates'}
            </span>
            {value.length > 1 && (
              <button
                type="button"
                onClick={copyFirstToAll}
                className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-slate-900"
              >
                <Copy size={11} /> Same times as first
              </button>
            )}
          </div>
          {value.map((o) => (
            <div
              key={o.date}
              className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_2rem] items-center gap-2"
            >
              <span className="truncate text-sm font-black text-slate-700">
                {label(o.date)}
              </span>
              <input
                type="time"
                lang="nl"
                aria-label={`Start time ${label(o.date)}`}
                value={o.start_time ?? ''}
                onChange={(e) => setTime(o.date, 'start_time', e.target.value)}
                className={timeStyle}
              />
              <input
                type="time"
                lang="nl"
                aria-label={`End time ${label(o.date)}`}
                value={o.end_time ?? ''}
                onChange={(e) => setTime(o.date, 'end_time', e.target.value)}
                className={timeStyle}
              />
              <button
                type="button"
                onClick={() => toggle(o.date)}
                aria-label={`Remove ${label(o.date)}`}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
