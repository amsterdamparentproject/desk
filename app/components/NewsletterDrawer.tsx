'use client'

import { useState } from 'react'
import { X, Copy, Check, Newspaper } from 'lucide-react'
import { DeskActivity } from '../types/activity'
import { parseRrule, computeNextDate } from '../utils/rrule'

// ─── Date helpers ────────────────────────────────────────────────────────────

function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toLocalStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDaysStr(dateStr: string, days: number): string {
  const d = parseLocal(dateStr)
  d.setDate(d.getDate() + days)
  return toLocalStr(d)
}

/**
 * Returns the effective start date for newsletter display.
 *
 * If the activity's start_date is before the newsletter window, it's a recurring event
 * whose base occurrence predates the window. We advance through the series to find
 * the first occurrence on or after windowStart.
 *
 * Biweekly uses 14-day stepping from start_date (phase-aware).
 * Weekly/monthly/daily use computeNextDate with a reference one day before windowStart.
 */
function getEffectiveStart(activity: DeskActivity, windowStart: string): string {
  const { start_date, repeat_frequency, repeat_rrule } = activity
  if (!start_date) return ''
  if (start_date >= windowStart) return start_date
  if (!repeat_frequency || !repeat_rrule) return start_date

  const parsed = parseRrule(repeat_rrule)
  if (!parsed.frequency) return start_date

  if (parsed.frequency === 'biweekly') {
    const wStart = parseLocal(windowStart)
    const current = parseLocal(start_date)
    while (current < wStart) current.setDate(current.getDate() + 14)
    if (parsed.untilDate) {
      const until = parseLocal(parsed.untilDate)
      if (current > until) return start_date
    }
    return toLocalStr(current)
  }

  const dayBefore = addDaysStr(windowStart, -1)
  return computeNextDate(parsed.frequency, parsed.days, parsed.untilDate, dayBefore) ?? start_date
}

// ─── Date display formatting (mirrors n8n workflow logic) ────────────────────

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtFull(d: Date)  { return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}` }
function fmtShort(d: Date) { return `${d.getDate()} ${MONTHS[d.getMonth()]}` }

function getDateDisplay(activity: DeskActivity, windowStart: string, windowEnd: string): string {
  const effectiveStart = getEffectiveStart(activity, windowStart)
  if (!effectiveStart) return ''

  const sd = parseLocal(effectiveStart)

  // Determine effective end date (shift for repeat occurrences)
  let effectiveEnd: Date | null = null
  if (activity.end_date && activity.start_date && activity.end_date > activity.start_date) {
    const origStart = parseLocal(activity.start_date)
    const origEnd   = parseLocal(activity.end_date)
    const delta     = origEnd.getTime() - origStart.getTime()
    effectiveEnd    = new Date(sd.getTime() + delta)
  }

  const pStart = parseLocal(windowStart)
  const pEnd   = parseLocal(windowEnd)

  const startTime = activity.start_time ? activity.start_time.substring(0, 5) : null
  const endTime   = activity.end_time   ? activity.end_time.substring(0, 5)   : null

  if (!effectiveEnd) {
    let timeDisplay = ''
    if (startTime) timeDisplay = ` @ ${startTime}`
    if (endTime)   timeDisplay += `-${endTime}`
    return fmtFull(sd) + timeDisplay
  }

  if (sd >= pStart && effectiveEnd <= pEnd) {
    return sd.getMonth() === effectiveEnd.getMonth()
      ? `${sd.getDate()}-${fmtShort(effectiveEnd)}`
      : `${fmtShort(sd)}-${fmtShort(effectiveEnd)}`
  }
  if (sd >= pStart && effectiveEnd > pEnd) return `Starting ${fmtShort(sd)}`
  if (sd < pStart  && effectiveEnd <= pEnd) return `Until ${fmtShort(effectiveEnd)}`
  return `${fmtShort(sd)}-${fmtShort(effectiveEnd)}`
}

function getRepeatLabel(activity: DeskActivity): string {
  switch (activity.repeat_frequency) {
    case 'daily':    return 'Daily'
    case 'weekly':   return 'Weekly'
    case 'biweekly': return 'Every 2 weeks'
    case 'monthly':  return 'Monthly'
    default:         return ''
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildNewsletterHTML(activities: DeskActivity[], publishDate: string): string {
  const windowStart = publishDate
  const windowEnd   = addDaysStr(publishDate, 14)

  // Group: highlighted events go into "APP & Friends" first
  const grouped: Record<string, DeskActivity[]> = { 'APP & Friends': [] }

  for (const a of activities) {
    const area = a.area || 'Other'
    if (!grouped[area]) grouped[area] = []

    if (a.newsletter_highlight) {
      grouped['APP & Friends'].push(a)
    } else {
      grouped[area].push(a)
    }
  }

  // Sort each group by effective start date ascending
  for (const area in grouped) {
    grouped[area].sort((a, b) => {
      const aDate = (a.type === 'event' ? getEffectiveStart(a, windowStart) : null) || a.start_date || ''
      const bDate = (b.type === 'event' ? getEffectiveStart(b, windowStart) : null) || b.start_date || ''
      return aDate.localeCompare(bDate)
    })
  }

  let html = ''

  for (const area in grouped) {
    if (grouped[area].length === 0) continue
    html += `<p><b>${escHtml(area)}</b></p>\n<ul style="list-style-type: disc; padding-left: 20px;">\n`

    for (const a of grouped[area]) {
      const dateDisplay        = a.type === 'event' ? getDateDisplay(a, windowStart, windowEnd) : ''
      const repeatLabel        = getRepeatLabel(a)
      const displayRepeat      = repeatLabel ? ` (${repeatLabel})` : ''
      const displayNeighborhood = (area !== 'Online' && a.neighborhood) ? ` — ${escHtml(a.neighborhood)}` : ''
      const displayTitle       = (a.age_range && a.age_range !== 'All ages')
        ? `${escHtml(a.title)} (${escHtml(a.age_range)})`
        : escHtml(a.title)

      html += `  <li style="margin-bottom: 20px;">\n`
      html += `    <p><a href="${escHtml(a.url ?? '#')}" target="_blank">${displayTitle}</a></p>\n`
      if (dateDisplay || displayRepeat || displayNeighborhood) {
        html += `    <p><i>${escHtml(dateDisplay)}${displayRepeat}${displayNeighborhood}</i></p>\n`
      }
      html += `    <p>${escHtml(a.newsletter_description)}</p>\n`
      html += `  </li>\n`
    }

    html += `</ul>\n`
  }

  return html
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NewsletterDrawerProps {
  activities: DeskActivity[]
  publishDate: string
  onClose: () => void
  onCopy?: () => void
}

export function NewsletterDrawer({ activities, publishDate, onClose, onCopy }: NewsletterDrawerProps) {
  const [copied, setCopied]   = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const nextActivities = activities.filter(a => a.list_id === 'next_newsletter' && a.status !== 'archived')
  const windowEnd      = addDaysStr(publishDate, 14)
  const html           = buildNewsletterHTML(nextActivities, publishDate)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    onCopy?.()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="sticky top-0 bg-green-600 border-b border-green-700 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3 ml-3">
            <Newspaper size={18} className="text-white" />
            <span className="text-lg tracking-wide text-white font-bold">Newsletter preview</span>
            <span className="text-xs text-green-200 font-mono">{publishDate} – {windowEnd}</span>
          </div>
          <button onClick={onClose} className="p-2 text-white hover:text-green-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          {nextActivities.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 italic">
              No activities in the next newsletter column
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[9px] font-black uppercase tracking-widest text-green-600">
                  {nextActivities.length} activit{nextActivities.length === 1 ? 'y' : 'ies'}
                </span>
                <button
                  onClick={() => setShowRaw(v => !v)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showRaw ? 'Show preview' : 'Show HTML'}
                </button>
              </div>

              {showRaw ? (
                <pre className="text-xs font-mono text-slate-600 bg-slate-50 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap border border-slate-200">
                  {html}
                </pre>
              ) : (
                <div
                  className="text-sm text-black [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-5 [&_p]:mb-1 [&_a]:text-blue-600 [&_a]:underline [&_b]:font-black"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20">
          <button
            onClick={handleCopy}
            disabled={nextActivities.length === 0}
            className={`w-full font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-40 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-slate-900 text-white hover:bg-green-600'
            }`}
          >
            {copied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} strokeWidth={3} />}
            {copied ? 'Copied to clipboard!' : 'Copy HTML'}
          </button>
        </div>
      </div>
    </div>
  )
}
