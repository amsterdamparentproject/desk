// components/ActivityDrawer.tsx
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  X,
  MapPin,
  ExternalLink,
  Clock,
  NotebookPen,
  Edit,
  Check,
  ImageIcon,
  RefreshCw,
  Calendar,
  Settings,
  Sparkles,
  Trash2,
  Archive,
  RotateCcw,
  BookmarkPlus,
  Mail,
  Newspaper,
} from 'lucide-react'
import {
  DeskActivity,
  DEFAULT_DESK_ACTIVITY,
  Location,
  RepeatFrequency,
  Service,
} from '../types/activity'
import { ALL_LISTS, ListId, getListTab } from '../types/list'
import { TriageStatus } from '../types/card'
import { useAutosizeTextArea } from '../hooks/useAutosizeTextArea'
import {
  parseRrule,
  buildRrule,
  computeNextDate,
  parsePositionalDay,
} from '../utils/rrule'
import { upsertLocation, dismissParseNotice } from '../actions/activities'
import { isPastEvent } from '@/lib/desk-table'
import { androidChromeIntent } from '@/lib/open-external'
import { ParseNotice } from './card/ParseNotice'
import { OccurrencePicker } from './OccurrencePicker'
import { AreaPills } from './AreaPills'
import { Pill } from './Pills'
import { HighlightToggle } from './HighlightToggle'
import { LavaSpinner } from './Lava'
import {
  occurrencesFromRange,
  rangeFromOccurrences,
  type Occurrence,
} from '@/lib/occurrences'

const baseInputStyle =
  'w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-lg py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors bg-surface'
const inputStyle = `${baseInputStyle} px-3`
const selectStyle = `${baseInputStyle} pl-3 pr-8 cursor-pointer`

export function sanitizeActivityInputs(activity: DeskActivity): DeskActivity {
  const cleanIncomingFields = Object.entries(activity).reduce<
    Record<string, unknown>
  >((acc, [key, value]) => {
    if (value !== null) acc[key] = value
    return acc
  }, {})
  const result = {
    ...DEFAULT_DESK_ACTIVITY,
    ...cleanIncomingFields,
  } as DeskActivity
  // Strip seconds from time fields — DB returns HH:MM:SS, inputs expect HH:MM
  if (result.start_time) result.start_time = result.start_time.substring(0, 5)
  if (result.end_time) result.end_time = result.end_time.substring(0, 5)
  // Default highlight to true for APP's own events, but only if not explicitly set in the DB
  if (
    result.organization === 'Amsterdam Parent Project' &&
    activity.newsletter_highlight === null
  ) {
    result.newsletter_highlight = true
  }
  return result
}

interface ActivityDrawerProps {
  activity: DeskActivity
  onSaveDraft: (data: DeskActivity) => void
  onFinishEditing: (data: DeskActivity) => void
  onClose: () => void
  onSendToAI?: (data: DeskActivity) => void
  onDelete?: (id: string, type: 'event' | 'resource') => void
  onConvertType?: (
    id: string,
    to: 'event' | 'resource'
  ) => Promise<Record<string, unknown> | null>
  readOnly?: boolean
  onRestore?: () => void
  locations?: Location[]
  onLocationSaved?: (loc: Location) => void
  onToggleService?: (service: Service, enabled: boolean) => void
  onToggleNextIssue?: (id: string, inNext: boolean) => void
}

// Same fixed-zone date the table uses, so the two agree on "past".
const todayInAmsterdam = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(
    new Date()
  )

const WEEKDAYS = [
  { label: 'Mon', abbr: 'MO' },
  { label: 'Tue', abbr: 'TU' },
  { label: 'Wed', abbr: 'WE' },
  { label: 'Thu', abbr: 'TH' },
  { label: 'Fri', abbr: 'FR' },
  { label: 'Sat', abbr: 'SA' },
  { label: 'Sun', abbr: 'SU' },
]

const TRIAGE_STATUSES: TriageStatus[] = [
  'new',
  'processing',
  'processed',
  'failed',
  'published',
  'archived',
]

const STATUS_COLORS: Record<TriageStatus, string> = {
  new: 'bg-blue-600 text-white',
  processing: 'bg-amber-500 text-white',
  processed: 'bg-purple-600 text-white',
  failed: 'bg-red-600 text-white',
  published: 'bg-teal-600 text-white',
  archived: 'bg-red-500 text-white',
}

export function ActivityDrawer({
  activity,
  onSaveDraft,
  onFinishEditing,
  onClose,
  onSendToAI,
  onDelete,
  onConvertType,
  readOnly,
  onRestore,
  locations = [],
  onLocationSaved,
  onToggleService,
  onToggleNextIssue,
}: ActivityDrawerProps) {
  const [formData, setFormData] = useState<DeskActivity>(() => {
    const initial = sanitizeActivityInputs(activity)
    // One-off events edit their dates in the calendar picker, so a single
    // date or legacy range is seeded as a list of dates (same times each day);
    // it's only saved once something is edited. Recurring events keep a single
    // start date as the series anchor.
    if (
      initial.type === 'event' &&
      !initial.repeat_rrule &&
      (initial.occurrences?.length ?? 0) === 0 &&
      initial.start_date
    ) {
      initial.occurrences = occurrencesFromRange(initial)
    }
    return initial
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null)
  const [locationSaveState, setLocationSaveState] = useState<
    'idle' | 'saving' | 'saved'
  >('idle')
  const [appliedLocationName, setAppliedLocationName] = useState<string>(
    () => locations.find((l) => l.address === activity.location)?.name ?? ''
  )

  // Always track latest formData so onBlur handlers don't capture stale closure values
  const latestFormData = useRef(formData)
  useLayoutEffect(() => {
    latestFormData.current = formData
  })
  const handleBlurSave = () => onSaveDraft(latestFormData.current)

  const [converting, setConverting] = useState(false)
  // Same rule as the row button on the Newsletter tab.
  const today = todayInAmsterdam()
  const canToggleNext =
    !!onToggleNextIssue &&
    !readOnly &&
    formData.list_id === 'refined' &&
    (formData.services ?? []).includes('newsletter') &&
    formData.status !== 'archived' &&
    formData.status !== 'published' &&
    (formData.in_next_issue || !isPastEvent(formData, today))

  const handleToggleNext = () => {
    if (!onToggleNextIssue) return
    const next = !formData.in_next_issue
    onToggleNextIssue(formData.id, next)
    setFormData((prev) => ({ ...prev, in_next_issue: next }))
  }

  const handleConvert = async () => {
    if (!onConvertType || converting) return
    const to = formData.type === 'event' ? 'resource' : 'event'
    if (
      to === 'resource' &&
      !window.confirm(
        'Convert to a resource? The date, time and repeat settings are removed (a note of the old schedule is kept in the triage notes), and it leaves the Post.'
      )
    ) {
      return
    }
    setConverting(true)
    try {
      // Flush any pending edit first so it lands before the row moves tables.
      await onSaveDraft(latestFormData.current)
      const patch = await onConvertType(formData.id, to)
      if (patch) setFormData((prev) => ({ ...prev, ...patch }) as DeskActivity)
    } finally {
      setConverting(false)
    }
  }

  const activityServices = formData.services ?? []
  const handleToggleService = (service: Service, enabled: boolean) => {
    const nextServices = enabled
      ? Array.from(new Set([...activityServices, service]))
      : activityServices.filter((s) => s !== service)
    const next = {
      ...latestFormData.current,
      services: nextServices,
      postpartum_post: nextServices.includes('postpartum_post'),
    }
    setFormData(next)
    if (onToggleService) {
      onToggleService(service, enabled)
    } else {
      onSaveDraft(next)
    }
  }

  const parsed = parseRrule(activity.repeat_rrule)
  const parsedMonthly =
    parsed.frequency === 'monthly' && parsed.days[0]
      ? parsePositionalDay(parsed.days[0])
      : null
  const [repeatFrequency, setRepeatFrequency] = useState<string>(
    parsed.frequency ?? ''
  )
  const [repeatDays, setRepeatDays] = useState<string[]>(
    parsed.frequency === 'weekly' || parsed.frequency === 'biweekly'
      ? parsed.days
      : []
  )
  const [repeatUntil, setRepeatUntil] = useState<string>(() => {
    // Only pre-fill until if it's meaningfully after the start_date (not just the event's own end date)
    if (!parsed.untilDate || !activity.start_date) return parsed.untilDate
    return parsed.untilDate > activity.start_date ? parsed.untilDate : ''
  })
  const [repeatMonthlyPos, setRepeatMonthlyPos] = useState<string>(
    parsedMonthly ? String(parsedMonthly.pos) : ''
  )
  const [repeatMonthlyDay, setRepeatMonthlyDay] = useState<string>(
    parsedMonthly ? parsedMonthly.abbr : ''
  )
  const DOW_TO_ABBR = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

  const effectiveDays =
    repeatFrequency === 'monthly' && repeatMonthlyPos && repeatMonthlyDay
      ? [`${repeatMonthlyPos}${repeatMonthlyDay}`]
      : repeatFrequency === 'weekly' || repeatFrequency === 'biweekly'
        ? repeatDays
        : []

  // Keep formData's rrule in sync with the repeat controls. This is derived
  // state, so adjust it during render (when the inputs change) rather than in
  // an effect, which would cost an extra render pass.
  const repeatKey = JSON.stringify([
    repeatFrequency,
    effectiveDays,
    repeatUntil,
  ])
  const [syncedRepeatKey, setSyncedRepeatKey] = useState<string | null>(null)
  if (syncedRepeatKey !== repeatKey) {
    setSyncedRepeatKey(repeatKey)
    const rrule = buildRrule({
      frequency: repeatFrequency,
      days: effectiveDays,
      untilDate: repeatUntil,
    })
    setFormData((prev) => ({
      ...prev,
      repeat_rrule: rrule || null,
      repeat_frequency: (repeatFrequency as RepeatFrequency) || null,
    }))
  }

  const changeFrequency = (next: string) => {
    setRepeatFrequency(next)
    // Recurring events anchor on one start date; one-off
    // events use the date picker.
    {
      const cur = latestFormData.current
      if (next && (cur.occurrences?.length ?? 0) > 0) {
        setOccurrences([], true)
      } else if (!next && cur.start_date) {
        setOccurrences(occurrencesFromRange(cur), true)
      }
    }
    if (next !== 'weekly' && next !== 'biweekly') {
      setRepeatDays([])
    } else if (formData.start_date) {
      const [wy, wm, wd] = formData.start_date.split('-').map(Number)
      setRepeatDays([DOW_TO_ABBR[new Date(wy, wm - 1, wd).getDay()]])
    }
    if (next !== 'monthly') {
      setRepeatMonthlyPos('')
      setRepeatMonthlyDay('')
    } else if (formData.start_date) {
      const [sy, sm, sd] = formData.start_date.split('-').map(Number)
      const d = new Date(sy, sm - 1, sd)
      const abbr = DOW_TO_ABBR[d.getDay()]
      const dom = d.getDate()
      const daysInMonth = new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0
      ).getDate()
      const pos = dom + 7 > daysInMonth ? -1 : Math.ceil(dom / 7)
      setRepeatMonthlyPos(String(pos))
      setRepeatMonthlyDay(abbr)
    }
  }

  const toggleRepeatDay = (abbr: string) => {
    setRepeatDays((prev) =>
      prev.includes(abbr) ? prev.filter((d) => d !== abbr) : [...prev, abbr]
    )
  }

  const rrulePreview = buildRrule({
    frequency: repeatFrequency,
    days: effectiveDays,
    untilDate: repeatUntil,
  })

  // Applies a new list of dates and keeps start/end date and the first date's
  // times in sync. Discrete actions (add/remove a day) save straight away;
  // typed time changes save on blur.
  const setOccurrences = (next: Occurrence[], commit: boolean) => {
    const range = rangeFromOccurrences(next)
    const updated: DeskActivity = {
      ...latestFormData.current,
      occurrences: next,
      ...(range ?? { end_date: null }),
    }
    latestFormData.current = updated
    setFormData(updated)
    if (commit) onSaveDraft(updated)
  }

  const blurbRef = useAutosizeTextArea(formData.newsletter_description)
  const rawDescRef = useAutosizeTextArea(formData.description)
  const notesRef = useAutosizeTextArea(formData.triage_notes || '')

  const handleChange = (field: keyof DeskActivity, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'organization' && value === 'Amsterdam Parent Project') {
        next.newsletter_highlight = true
      }
      return next
    })
  }

  const handleDateChange = (field: keyof DeskActivity, value: unknown) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      if (field === 'start_time' || field === 'end_time') {
        if (updated.start_time && updated.end_time) {
          const endDate = updated.end_date || updated.start_date
          const start = new Date(`${updated.start_date}T${updated.start_time}`)
          const end = new Date(`${endDate}T${updated.end_time}`)
          if (end < start) updated.duration_minutes = 0
          else
            updated.duration_minutes = Math.round(
              (end.getTime() - start.getTime()) / 60000
            )
        }
      }

      if (field === 'duration_minutes') {
        const mins = parseInt(String(value)) || 0
        updated.duration_minutes = mins
        if (updated.start_time && mins > 0) {
          const start = new Date(`${updated.start_date}T${updated.start_time}`)
          const end = new Date(start.getTime() + mins * 60000)
          updated.end_date = end.toISOString().split('T')[0]
          updated.end_time = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
        }
      }
      return updated
    })
  }

  // Saved location helpers
  const hasExistingLocation = !!(
    formData.location ||
    formData.neighborhood ||
    formData.area
  )
  const applyLocation = (loc: Location) => {
    const next = {
      ...latestFormData.current,
      location: loc.address,
      neighborhood: loc.neighborhood ?? latestFormData.current.neighborhood,
      area: loc.area ?? latestFormData.current.area,
    }
    setFormData(next)
    onSaveDraft(next)
    setAppliedLocationName(loc.name)
    setPendingLocation(null)
  }

  const handleSaveToLocations = async () => {
    if (!formData.organization || !formData.location) return
    setLocationSaveState('saving')
    try {
      const saved = await upsertLocation({
        name: formData.organization,
        address: formData.location,
        area: formData.area ?? null,
        neighborhood: formData.neighborhood ?? null,
      })
      onLocationSaved?.(saved)
      setLocationSaveState('saved')
      setTimeout(() => setLocationSaveState('idle'), 2000)
    } catch (e) {
      console.error('upsertLocation failed:', e)
      setLocationSaveState('idle')
    }
  }

  const requestApplyLocation = (loc: Location) => {
    if (hasExistingLocation) {
      setPendingLocation(loc)
    } else {
      applyLocation(loc)
    }
  }

  const displayImageUrl = formData.preview_url || formData.file_url
  const descriptionStyle =
    'w-full text-sm leading-relaxed text-slate-900 border border-slate-200 p-3 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none overflow-hidden bg-blue-50/60 rounded-lg transition-colors'

  return (
    <div
      className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-surface h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {activity.status === 'processing' && (
          <div className="absolute inset-0 bg-surface/90 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 z-30">
            <LavaSpinner width={54} height={26} label="Processing" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Processing
            </span>
          </div>
        )}

        {/* Header */}
        <div
          className={`sticky top-0 p-4 flex items-center justify-between z-20 ${readOnly ? 'bg-slate-500' : 'bg-blue-600'}`}
        >
          <div className="flex items-center gap-2">
            {readOnly ? (
              <Archive size={18} className="text-white ml-3" />
            ) : (
              <Edit size={18} className="text-white ml-3" />
            )}
            <span className="text-lg tracking-wide text-white font-bold pl-2 py-1 rounded">
              {readOnly ? `Archived ${activity.type}` : `Edit ${activity.type}`}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white hover:text-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {activity.status === 'published' && activity.newsletter_last && (
          <div className="bg-green-800 px-5 py-3 flex items-center gap-2.5">
            <Check size={14} className="text-white shrink-0" />
            <span className="text-sm font-black text-white tracking-wide flex-1">
              Published in{' '}
              {new Date(
                activity.newsletter_last + 'T00:00:00'
              ).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}{' '}
              issue
            </span>
            <button
              type="button"
              onClick={() => {
                const next = {
                  ...latestFormData.current,
                  newsletter_last: null,
                  status: 'processed' as const,
                  in_next_issue: false,
                  list_id: 'inbox' as import('../types/list').ListId,
                }
                setFormData(next)
                onSaveDraft(next)
              }}
              className="text-[10px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors whitespace-nowrap"
            >
              Mark as unpublished
            </button>
          </div>
        )}

        <div
          className={`p-4 md:p-8 space-y-6 md:space-y-8 pb-16 ${readOnly ? 'pointer-events-none select-none opacity-60' : ''}`}
        >
          {/* Primary content */}
          <section className="space-y-4">
            <ParseNotice
              activity={formData}
              onDismiss={async () => {
                await dismissParseNotice(formData.id, formData.type)
                setFormData((prev) => ({
                  ...prev,
                  parse_error: null,
                  parse_warnings: [],
                }))
              }}
            />
            <Field label="Title">
              <div className="title-underline">
                <input
                  className="w-full border-none p-0 pb-1 font-display text-xl font-bold leading-tight tracking-tight text-slate-900 focus:outline-none focus:ring-0 md:text-2xl"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  onBlur={handleBlurSave}
                />
              </div>
            </Field>

            <Field label="Source URL">
              <div className="flex items-center gap-2">
                <input
                  value={formData.url ?? ''}
                  onChange={(e) => handleChange('url', e.target.value)}
                  onBlur={handleBlurSave}
                  placeholder="https://example.com/activity-details"
                  className={inputStyle + ' font-mono text-blue-300'}
                />
                {formData.url && (
                  <a
                    href={formData.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      const intent = androidChromeIntent(formData.url ?? '')
                      if (intent) {
                        e.preventDefault()
                        window.location.href = intent
                      }
                    }}
                    className="group flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-app-gold bg-app-gold px-3.5 py-2 font-display text-xs font-bold text-ink shadow-[3px_3px_0_rgba(227,45,212,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:-rotate-2 hover:shadow-[5px_5px_0_rgba(227,45,212,0.85),0_0_18px_rgba(255,191,0,0.55)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none"
                  >
                    Check it out
                    <ExternalLink
                      size={14}
                      strokeWidth={3}
                      className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-1 group-hover:scale-125 motion-reduce:transform-none"
                    />
                  </a>
                )}
              </div>
            </Field>
            {formData.organization === 'Amsterdam Parent Project' && (
              <Field label="Website tagline">
                <input
                  value={formData.tagline ?? ''}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  onBlur={handleBlurSave}
                  placeholder="One sentence for the APP website..."
                  className={descriptionStyle}
                />
              </Field>
            )}

            <Field label="Newsletter blurb">
              <textarea
                ref={blurbRef}
                value={formData.newsletter_description}
                onChange={(e) =>
                  handleChange('newsletter_description', e.target.value)
                }
                onBlur={handleBlurSave}
                className={descriptionStyle}
                placeholder="Create a succinct newsletter snippet description..."
              />
            </Field>

            <div className="flex gap-4">
              <HighlightToggle
                checked={!!formData.newsletter_highlight}
                onChange={(v) => {
                  handleChange('newsletter_highlight', v)
                  onSaveDraft({ ...formData, newsletter_highlight: v })
                }}
              />
            </div>

            <div>
              <div className="flex flex-row items-center gap-2 mb-2">
                <Newspaper size={18} className="text-green-300" />
                <h2 className="text-green-300 text-base md:text-xl font-black whitespace-nowrap">
                  Services
                </h2>
              </div>
              <div className="flex flex-wrap gap-3">
                <Pill
                  role="checkbox"
                  color="blue"
                  index={0}
                  active={activityServices.includes('newsletter')}
                  onClick={() =>
                    handleToggleService(
                      'newsletter',
                      !activityServices.includes('newsletter')
                    )
                  }
                >
                  <span className="flex items-center gap-2">
                    <Newspaper size={16} />
                    Newsletter
                  </span>
                </Pill>
                {/* Post never takes resources — the Postpartum Post matcher only
                    queries events, locations, and playgrounds. */}
                {formData.type === 'event' && (
                  <Pill
                    role="checkbox"
                    color="magenta"
                    index={1}
                    active={activityServices.includes('postpartum_post')}
                    onClick={() =>
                      handleToggleService(
                        'postpartum_post',
                        !activityServices.includes('postpartum_post')
                      )
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Mail size={16} />
                      Postpartum Post
                    </span>
                  </Pill>
                )}
              </div>
            </div>
          </section>

          {/* Date & time — events only */}
          {formData.type === 'event' && (
            <section className="space-y-4 py-2">
              <div className="flex flex-row items-center gap-2 mb-2">
                <Clock size={18} className="text-slate-700" />
                <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">
                  Date & time
                </h2>
              </div>
              {!repeatFrequency ? (
                <div onBlur={handleBlurSave}>
                  <OccurrencePicker
                    value={formData.occurrences ?? []}
                    onChange={setOccurrences}
                  />
                </div>
              ) : (
                <>
                  <div className={`grid gap-4 grid-cols-1`}>
                    <Field label="Start Date">
                      <DateInput
                        value={formData.start_date ?? ''}
                        onChange={(v) => handleDateChange('start_date', v)}
                        onBlur={handleBlurSave}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:gap-4">
                    <Field label="Start Time">
                      <TimeInput
                        value={formData.start_time ?? ''}
                        onChange={(v) => handleDateChange('start_time', v)}
                        onBlur={handleBlurSave}
                      />
                    </Field>
                    <Field label="End Time">
                      <TimeInput
                        value={formData.end_time ?? ''}
                        onChange={(v) => handleDateChange('end_time', v)}
                        onBlur={handleBlurSave}
                      />
                    </Field>
                    <Field label="Duration (min)">
                      <input
                        type="number"
                        value={formData.duration_minutes ?? 0}
                        onChange={(e) =>
                          handleDateChange('duration_minutes', e.target.value)
                        }
                        onBlur={handleBlurSave}
                        className={inputStyle}
                      />
                    </Field>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Repeat */}
          {formData.type === 'event' && (
            <section className="space-y-4 py-2">
              <div className="flex flex-row items-center gap-2 mb-2">
                <RefreshCw size={18} className="text-slate-700" />
                <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">
                  Repeat
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-2 md:gap-4">
                <Field label="Repeats">
                  <div
                    role="radiogroup"
                    aria-label="Repeat"
                    className="flex flex-wrap gap-2"
                  >
                    {[
                      ['', "Doesn't repeat"],
                      ['daily', 'Daily'],
                      ['weekly', 'Weekly'],
                      ['biweekly', 'Every 2 weeks'],
                      ['monthly', 'Monthly'],
                    ].map(([value, label], i) => (
                      <Pill
                        key={value || 'none'}
                        role="radio"
                        color="amber"
                        index={i}
                        active={repeatFrequency === value}
                        onClick={() => {
                          changeFrequency(value)
                          setTimeout(handleBlurSave, 0)
                        }}
                      >
                        {label}
                      </Pill>
                    ))}
                  </div>
                </Field>
              </div>
              {repeatFrequency === 'monthly' && (
                <div className="reveal space-y-3">
                  <Field label="On the">
                    <div className="flex flex-wrap gap-2">
                      {[
                        ['1', '1st'],
                        ['2', '2nd'],
                        ['3', '3rd'],
                        ['4', '4th'],
                        ['-1', 'Last'],
                      ].map(([value, label], i) => (
                        <Pill
                          key={value}
                          role="radio"
                          color="amber"
                          index={i}
                          size="sm"
                          active={repeatMonthlyPos === value}
                          onClick={() => {
                            setRepeatMonthlyPos(value)
                            setTimeout(handleBlurSave, 0)
                          }}
                        >
                          {label}
                        </Pill>
                      ))}
                    </div>
                  </Field>
                  {repeatMonthlyPos && (
                    <Field label="Weekday">
                      <div className="reveal flex flex-wrap gap-2">
                        {WEEKDAYS.map(({ label, abbr }, i) => (
                          <Pill
                            key={abbr}
                            role="radio"
                            color="amber"
                            index={i}
                            size="sm"
                            active={repeatMonthlyDay === abbr}
                            onClick={() => {
                              setRepeatMonthlyDay(abbr)
                              setTimeout(handleBlurSave, 0)
                            }}
                          >
                            {label}
                          </Pill>
                        ))}
                      </div>
                    </Field>
                  )}
                </div>
              )}

              {(repeatFrequency === 'weekly' ||
                repeatFrequency === 'biweekly') && (
                <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 items-end">
                  <Field label="Days of week">
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map(({ label, abbr }, i) => (
                        <Pill
                          key={abbr}
                          role="checkbox"
                          color="amber"
                          index={i}
                          size="sm"
                          active={repeatDays.includes(abbr)}
                          onClick={() => {
                            toggleRepeatDay(abbr)
                            setTimeout(handleBlurSave, 0)
                          }}
                        >
                          {label}
                        </Pill>
                      ))}
                    </div>
                  </Field>
                  <Field label="Last repeat (inclusive)">
                    <DateInput
                      value={repeatUntil}
                      onChange={setRepeatUntil}
                      onBlur={handleBlurSave}
                    />
                  </Field>
                </div>
              )}

              {repeatFrequency &&
                repeatFrequency !== 'weekly' &&
                repeatFrequency !== 'biweekly' && (
                  <div className="reveal">
                    <Field label="Last repeat (inclusive)">
                      <DateInput
                        value={repeatUntil}
                        onChange={setRepeatUntil}
                        onBlur={handleBlurSave}
                      />
                    </Field>
                  </div>
                )}

              {rrulePreview && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-green-300 font-black uppercase tracking-widest">
                    RRULE
                  </span>
                  <code className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg font-mono break-all">
                    {rrulePreview}
                  </code>
                </div>
              )}

              {repeatFrequency && (
                <Field label="Next occurrence">
                  <div className="flex gap-2">
                    <DateInput
                      value={(formData.repeat_next_date ?? '').slice(0, 10)}
                      onChange={(v) =>
                        handleChange('repeat_next_date', v || null)
                      }
                      onBlur={handleBlurSave}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = computeNextDate(
                          repeatFrequency,
                          effectiveDays,
                          repeatUntil,
                          formData.start_date
                        )
                        const updated = {
                          ...latestFormData.current,
                          repeat_next_date: next,
                        }
                        setFormData(updated)
                        onSaveDraft(updated)
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-black whitespace-nowrap"
                    >
                      <RefreshCw size={12} /> Recalculate
                    </button>
                  </div>
                </Field>
              )}
            </section>
          )}

          {/* Place */}
          <section className="space-y-4">
            <div className="flex flex-row items-center gap-2 mb-2">
              <MapPin size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">
                Place
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <Field label="Host Organization">
                <PlaceCombobox
                  value={formData.organization ?? ''}
                  locations={locations}
                  inputStyle={inputStyle}
                  onChange={(val) => handleChange('organization', val)}
                  onSelectLocation={(loc) => {
                    handleChange('organization', loc.name)
                    requestApplyLocation(loc)
                  }}
                  onBlur={handleBlurSave}
                />
              </Field>
              <Field label="Location name">
                <PlaceCombobox
                  value={pendingLocation?.name ?? appliedLocationName}
                  locations={locations}
                  inputStyle={inputStyle}
                  onChange={setAppliedLocationName}
                  onSelectLocation={(loc) => requestApplyLocation(loc)}
                  onBlur={handleBlurSave}
                />
              </Field>
            </div>

            {pendingLocation && (
              <OverwriteConfirm
                loc={pendingLocation}
                onConfirm={() => applyLocation(pendingLocation)}
                onCancel={() => {
                  setPendingLocation(null)
                }}
              />
            )}

            <Field label="Area">
              <AreaPills
                value={formData.area}
                onChange={(area) => {
                  handleChange('area', area)
                  setTimeout(handleBlurSave, 0)
                }}
              />
            </Field>
            <div className="grid gap-2 md:gap-4">
              <Field label="Neighborhood">
                <input
                  value={formData.neighborhood ?? ''}
                  onChange={(e) => handleChange('neighborhood', e.target.value)}
                  onBlur={handleBlurSave}
                  className={inputStyle}
                />
              </Field>
            </div>
            <div className="grid gap-4">
              <Field label="Address">
                <input
                  value={formData.location ?? ''}
                  onChange={(e) => handleChange('location', e.target.value)}
                  onBlur={handleBlurSave}
                  className={inputStyle}
                />
              </Field>
            </div>

            {formData.organization && formData.location && (
              <button
                type="button"
                onClick={handleSaveToLocations}
                disabled={locationSaveState === 'saving'}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50
                  bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-300"
              >
                {locationSaveState === 'saved' ? (
                  <>
                    <Check size={12} /> Saved
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={12} /> Save to locations
                  </>
                )}
              </button>
            )}
          </section>

          {/* Details */}
          <section className="space-y-4">
            <div className="flex flex-row items-center gap-2 mb-2">
              <NotebookPen size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">
                Details
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[3fr_7fr]">
              <Field label="Target Age Range">
                <input
                  value={formData.age_range ?? ''}
                  onChange={(e) => handleChange('age_range', e.target.value)}
                  onBlur={handleBlurSave}
                  className={inputStyle}
                />
              </Field>
              <Field label="Age Categories">
                <AgeCategorySelector
                  selected={formData.age_categories ?? []}
                  onChange={(cats) => {
                    handleChange('age_categories', cats)
                  }}
                  onBlur={handleBlurSave}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                ref={rawDescRef}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                onBlur={handleBlurSave}
                className={descriptionStyle}
                placeholder="Full text scraped or transcribed from original source submission..."
              />
            </Field>
          </section>

          {/* Image */}
          <section className="space-y-3">
            <div className="flex flex-row items-center gap-2 mb-2">
              <ImageIcon size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">
                Image
              </h2>
              <p className="text-sm text-slate-400 italic">
                Used on the website for APP events
              </p>
            </div>
            <Field label="Image URL">
              <input
                value={formData.file_url ?? ''}
                onChange={(e) => handleChange('file_url', e.target.value)}
                onBlur={handleBlurSave}
                placeholder="https://..."
                className={inputStyle + ' font-mono text-xs'}
              />
            </Field>
            {displayImageUrl && (
              <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-96 flex justify-center items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URLs and local blob previews can't use next/image */}
                <img
                  src={displayImageUrl}
                  alt="Activity image"
                  className="max-h-96 w-full object-contain"
                />
                {formData.preview_url && (
                  <div className="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-black px-2 py-1 uppercase rounded shadow">
                    Local preview (Syncing...)
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Triage */}
          <section className="space-y-4">
            <div className="flex flex-row items-center gap-2 mb-2">
              <Settings size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">
                Triage
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <Field label="Status">
                <select
                  value={formData.status}
                  onChange={(e) => {
                    const s = e.target.value as TriageStatus
                    const next = { ...latestFormData.current, status: s }
                    setFormData(next)
                    onSaveDraft(next)
                  }}
                  className={`w-full rounded-lg py-2 px-3 text-sm font-black uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors border-0 ${STATUS_COLORS[formData.status as TriageStatus] ?? 'bg-slate-100 text-slate-500'}`}
                >
                  {TRIAGE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Source">
                <select
                  value={formData.source}
                  onChange={(e) => handleChange('source', e.target.value)}
                  onBlur={handleBlurSave}
                  className={selectStyle}
                >
                  <option value="app_desk">APP Desk</option>
                  <option value="app_website">APP Website</option>
                  <option value="manual">Manual</option>
                  <option value="luma">Luma</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <Field label="In list">
                <div
                  role="radiogroup"
                  aria-label="In list"
                  className="flex flex-wrap gap-2"
                >
                  {ALL_LISTS.map((l, i) => (
                    <Pill
                      key={l.id}
                      role="radio"
                      color="blue"
                      size="sm"
                      index={i}
                      active={formData.list_id === l.id}
                      onClick={() => {
                        const next = {
                          ...latestFormData.current,
                          list_id: l.id as ListId,
                        }
                        setFormData(next)
                        onSaveDraft(next)
                      }}
                    >
                      {l.label}
                    </Pill>
                  ))}
                </div>
              </Field>
              <Field label="Newsletter last">
                <div
                  className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}
                >
                  {formData.newsletter_last
                    ? new Date(
                        formData.newsletter_last + 'T00:00:00'
                      ).toLocaleDateString('en-GB')
                    : '—'}
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
              <Field label="Created">
                <div
                  className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}
                >
                  {formData.created_at
                    ? new Date(formData.created_at).toLocaleString('en-GB')
                    : '—'}
                </div>
              </Field>
              <Field label="Last edited">
                <div
                  className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}
                >
                  {formData.updated_at
                    ? new Date(formData.updated_at).toLocaleString('en-GB')
                    : '—'}
                </div>
              </Field>
              <Field label="Record id">
                <div
                  title={formData.id ?? 'No id'}
                  className={`${inputStyle} truncate bg-amber-50 font-mono text-xs text-amber-300 border-amber-200`}
                >
                  {formData.id ?? 'No id'}
                </div>
              </Field>
            </div>

            <textarea
              ref={notesRef}
              value={formData.triage_notes || ''}
              onChange={(e) => handleChange('triage_notes', e.target.value)}
              onBlur={handleBlurSave}
              className="w-full text-sm leading-relaxed text-slate-900 border border-amber-200 p-3 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none overflow-hidden bg-amber-50/80 rounded-lg transition-colors"
              placeholder="Add administrative context notes here..."
            />

            <div className="flex flex-wrap items-center gap-2">
              {onConvertType && !readOnly && !confirmDelete && (
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={converting}
                  className="flex items-center gap-2 rounded-lg border-2 border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  {converting
                    ? 'Converting…'
                    : formData.type === 'event'
                      ? 'Convert to resource →'
                      : 'Convert to event →'}
                </button>
              )}
              {onDelete &&
                (confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-red-300">
                      Are you sure?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(formData.id, formData.type)
                        onClose()
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      <Trash2 size={13} /> Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest text-red-300 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                  >
                    <Trash2 size={13} /> Delete record permanently
                  </button>
                ))}
            </div>
          </section>
        </div>

        {/* Footer actions */}
        {readOnly ? (
          <div className="sticky bottom-0 bg-surface border-t border-slate-100 p-6 z-20 flex gap-3">
            {onRestore && (
              <button
                onClick={() => {
                  onRestore()
                  onClose()
                }}
                className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                <RotateCcw size={18} strokeWidth={3} /> Restore
              </button>
            )}
            {onDelete &&
              (confirmDelete ? (
                <div className="flex-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      onDelete(formData.id, formData.type)
                      onClose()
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-4 text-xs font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-colors"
                  >
                    <Trash2 size={14} /> Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-4 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest text-red-300 bg-red-50 hover:bg-red-600 hover:text-white rounded-2xl transition-colors"
                >
                  <Trash2 size={18} strokeWidth={3} /> Delete forever
                </button>
              ))}
          </div>
        ) : (
          ((onSendToAI && getListTab(formData.list_id) === 'triage') ||
            canToggleNext ||
            !!ALL_LISTS.find((l) => l.id === formData.list_id)
              ?.finishLabel) && (
            <div className="sticky bottom-0 bg-surface border-t border-slate-100 p-6 z-20 flex gap-4">
              {canToggleNext && (
                <button
                  type="button"
                  onClick={handleToggleNext}
                  className={`w-full font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs ${
                    formData.in_next_issue
                      ? 'border-2 border-app-gold bg-transparent text-amber-300 hover:bg-app-gold hover:text-ink'
                      : 'bg-app-gold text-ink shadow-[4px_4px_0_rgba(227,45,212,0.85)] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                  }`}
                >
                  {formData.in_next_issue ? (
                    <>
                      <X size={18} strokeWidth={3} /> Remove from next
                      newsletter
                    </>
                  ) : (
                    <>
                      <Newspaper size={18} strokeWidth={3} /> Add to next
                      newsletter
                    </>
                  )}
                </button>
              )}
              {onSendToAI && getListTab(formData.list_id) === 'triage' && (
                <button
                  onClick={() => onSendToAI(formData)}
                  className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                >
                  <Sparkles size={18} strokeWidth={3} /> Send to AI
                </button>
              )}
              {ALL_LISTS.find((l) => l.id === formData.list_id)
                ?.finishLabel && (
                <button
                  onClick={() => onFinishEditing(formData)}
                  disabled={
                    formData.list_id === 'inbox' &&
                    (formData.services ?? []).length === 0
                  }
                  title={
                    formData.list_id === 'inbox' &&
                    (formData.services ?? []).length === 0
                      ? 'Choose Newsletter and/or Post first'
                      : undefined
                  }
                  className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-40 disabled:hover:bg-green-600 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <Check size={18} strokeWidth={3} />
                  {
                    ALL_LISTS.find((l) => l.id === formData.list_id)
                      ?.finishLabel
                  }
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function DateInput({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => ref.current?.showPicker()}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
      >
        <Calendar size={14} />
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${inputStyle} pl-8 [&::-webkit-calendar-picker-indicator]:hidden`}
      />
    </div>
  )
}

function TimeInput({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => ref.current?.showPicker()}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
      >
        <Clock size={14} />
      </button>
      <input
        ref={ref}
        type="time"
        lang="nl"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`${inputStyle} pl-8 [&::-webkit-calendar-picker-indicator]:hidden`}
      />
    </div>
  )
}

function OverwriteConfirm({
  loc,
  onConfirm,
  onCancel,
  label,
}: {
  loc: Location
  onConfirm: () => void
  onCancel: () => void
  label?: string
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <span className="text-amber-300 font-bold flex-1">
        {label ?? (
          <>
            Overwrite existing location with{' '}
            <span className="italic">{loc.name}</span>?
          </>
        )}
      </span>
      <button
        type="button"
        onClick={onConfirm}
        className="px-2.5 py-1 text-xs font-black uppercase tracking-wide bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2.5 py-1 text-xs font-black uppercase tracking-wide bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}

function PlaceCombobox({
  value,
  locations,
  inputStyle,
  onChange,
  onSelectLocation,
  onBlur,
}: {
  value: string
  locations: Location[]
  inputStyle: string
  onChange: (val: string) => void
  onSelectLocation: (loc: Location) => void
  onBlur: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = locations.filter((loc) =>
    loc.name.toLowerCase().includes(value.toLowerCase())
  )

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        className={inputStyle}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-surface border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((loc) => (
            <li key={loc.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault() // prevent input blur before click registers
                  onSelectLocation(loc)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center gap-2"
              >
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-700">{loc.name}</span>
                <span className="text-slate-400 text-xs truncate">
                  {loc.address}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] text-green-300 font-black uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  )
}

const AGE_CATEGORY_OPTIONS = [
  'all ages',
  'expecting',
  'newborn',
  'baby',
  'toddler',
]

function AgeCategorySelector({
  selected,
  onChange,
  onBlur,
}: {
  selected: string[]
  onChange: (cats: string[]) => void
  onBlur?: () => void
}) {
  const toggle = (cat: string) => {
    const next = selected.includes(cat)
      ? selected.filter((c) => c !== cat)
      : [...selected, cat]
    onChange(next)
    setTimeout(() => onBlur?.(), 0)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {AGE_CATEGORY_OPTIONS.map((cat, i) => (
        <Pill
          key={cat}
          role="checkbox"
          color="blue"
          index={i}
          active={selected.includes(cat)}
          onClick={() => toggle(cat)}
        >
          {cat}
        </Pill>
      ))}
    </div>
  )
}
