'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Plus, X } from 'lucide-react'
import { distinctDates, type Occurrence } from '@/lib/occurrences'

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
// usually what you want) or click it again to remove it. A day can have
// several sessions: "Add time" gives it another start/end pair.
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
  const days = distinctDates(value)
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
    // A new day copies the previous day's sessions.
    const prevDate = [...distinctDates(value)].reverse().find((d) => d < date)
    const template = value.filter(
      (o) => o.date === (prevDate ?? value[0]?.date)
    )
    const added: Occurrence[] = (
      template.length > 0
        ? template
        : [{ date, start_time: null, end_time: null }]
    ).map((t) => ({
      date,
      start_time: t.start_time,
      end_time: t.end_time,
    }))
    onChange(
      [...value, ...added].sort((a, b) => a.date.localeCompare(b.date)),
      true
    )
  }

  // Edits address a session by its index in `value`, so two sessions on one
  // day stay independent.
  const setTime = (
    index: number,
    field: 'start_time' | 'end_time',
    time: string
  ) =>
    onChange(
      value.map((o, i) => (i === index ? { ...o, [field]: time || null } : o)),
      false
    )

  const addSession = (date: string) => {
    const last = value.map((o) => o.date).lastIndexOf(date)
    const next = [...value]
    next.splice(last + 1, 0, { date, start_time: null, end_time: null })
    onChange(next, true)
  }

  const removeSession = (index: number) => {
    const date = value[index].date
    // Removing a day's only session removes the day.
    if (value.filter((o) => o.date === date).length === 1) {
      toggle(date)
      return
    }
    onChange(
      value.filter((_, i) => i !== index),
      true
    )
  }

  // Every day gets the first day's sessions.
  const copyFirstToAll = () => {
    const firstDate = value[0]?.date
    if (!firstDate) return
    const sessions = value.filter((o) => o.date === firstDate)
    onChange(
      distinctDates(value).flatMap((date) =>
        sessions.map((t) => ({
          date,
          start_time: t.start_time,
          end_time: t.end_time,
        }))
      ),
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
              {days.length} {days.length === 1 ? 'date' : 'dates'}
            </span>
            {days.length > 1 && (
              <button
                type="button"
                onClick={copyFirstToAll}
                className="inline-flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-slate-900"
              >
                <Copy size={11} /> Same times as first
              </button>
            )}
          </div>
          {days.map((date) => {
            const sessions = value
              .map((o, index) => ({ o, index }))
              .filter(({ o }) => o.date === date)
            return (
              <div key={date} className="space-y-1.5">
                {sessions.map(({ o, index }, n) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_2rem] items-center gap-2"
                  >
                    <span className="truncate text-sm font-black text-slate-700">
                      {n === 0 ? label(date) : ''}
                    </span>
                    <input
                      type="time"
                      lang="nl"
                      aria-label={`Start time ${label(date)}${sessions.length > 1 ? ` (${n + 1})` : ''}`}
                      value={o.start_time ?? ''}
                      onChange={(e) =>
                        setTime(index, 'start_time', e.target.value)
                      }
                      className={timeStyle}
                    />
                    <input
                      type="time"
                      lang="nl"
                      aria-label={`End time ${label(date)}${sessions.length > 1 ? ` (${n + 1})` : ''}`}
                      value={o.end_time ?? ''}
                      onChange={(e) =>
                        setTime(index, 'end_time', e.target.value)
                      }
                      className={timeStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeSession(index)}
                      aria-label={
                        sessions.length > 1
                          ? `Remove time ${n + 1} on ${label(date)}`
                          : `Remove ${label(date)}`
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSession(date)}
                  className="ml-0 inline-flex items-center gap-1 text-[11px] font-black text-slate-400 hover:text-slate-900"
                >
                  <Plus size={11} /> Add time
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
