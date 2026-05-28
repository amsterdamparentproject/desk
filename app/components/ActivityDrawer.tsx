// components/ActivityDrawer.tsx
import { ReactNode, useEffect, useRef, useState, useCallback } from 'react'
import { X, MapPin, ExternalLink, Clock, Star, NotebookPen, Edit, Check, ImageIcon, SkipForward, RefreshCw, Calendar, Settings, Sparkles, Trash2, Archive, RotateCcw, BookmarkPlus } from 'lucide-react'
import { DeskActivity, DEFAULT_DESK_ACTIVITY, Location, RepeatFrequency } from '../types/activity'
import { ALL_LISTS, ListId, getListTab } from '../types/list'
import { TriageStatus } from '../types/card'
import { useAutosizeTextArea } from "../hooks/useAutosizeTextArea";
import { parseRrule, buildRrule, computeNextDate, parsePositionalDay } from '../utils/rrule';
import { upsertLocation } from '../actions/activities';

const AREAS = ['West', 'East', 'North', 'Center', 'South', 'Everywhere', 'Online']

const baseInputStyle = "w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-lg py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors bg-white"
const inputStyle = `${baseInputStyle} px-3`
const selectStyle = `${baseInputStyle} pl-3 pr-8 cursor-pointer`

export function sanitizeActivityInputs(activity: DeskActivity): DeskActivity {
  const cleanIncomingFields = Object.entries(activity).reduce<Record<string, any>>((acc, [key, value]) => {
    if (value !== null) acc[key] = value;
    return acc;
  }, {});
  const result = { ...DEFAULT_DESK_ACTIVITY, ...cleanIncomingFields } as DeskActivity;
  // Strip seconds from time fields — DB returns HH:MM:SS, inputs expect HH:MM
  if (result.start_time) result.start_time = result.start_time.substring(0, 5)
  if (result.end_time) result.end_time = result.end_time.substring(0, 5)
  // Default highlight to true for APP's own events, but only if not explicitly set in the DB
  if (result.organization === 'Amsterdam Parent Project' && activity.newsletter_highlight === null) {
    result.newsletter_highlight = true;
  }
  return result;
}

interface ActivityDrawerProps {
  activity: DeskActivity,
  onSaveDraft: (data: DeskActivity) => void,
  onFinishEditing: (data: DeskActivity) => void,
  onClose: () => void,
  publishDate?: string,
  onSendToAI?: (data: DeskActivity) => void,
  onDelete?: (id: string, type: 'event' | 'resource') => void,
  readOnly?: boolean,
  onRestore?: () => void,
  locations?: Location[],
  onLocationSaved?: (loc: Location) => void,
}

const WEEKDAYS = [
  { label: 'Mon', abbr: 'MO' },
  { label: 'Tue', abbr: 'TU' },
  { label: 'Wed', abbr: 'WE' },
  { label: 'Thu', abbr: 'TH' },
  { label: 'Fri', abbr: 'FR' },
  { label: 'Sat', abbr: 'SA' },
  { label: 'Sun', abbr: 'SU' },
]

const TRIAGE_STATUSES: TriageStatus[] = ['new', 'processing', 'processed', 'edited', 'archived', 'snoozed']

const STATUS_COLORS: Record<TriageStatus, string> = {
  new:        'bg-blue-600 text-white',
  processing: 'bg-amber-500 text-white',
  processed:  'bg-purple-600 text-white',
  edited:     'bg-green-600 text-white',
  archived:   'bg-red-500 text-white',
  snoozed:    'bg-slate-500 text-white',
}

export function ActivityDrawer({ activity, onSaveDraft, onFinishEditing, onClose, publishDate, onSendToAI, onDelete, readOnly, onRestore, locations = [], onLocationSaved }: ActivityDrawerProps) {
  const [formData, setFormData] = useState<DeskActivity>(() => sanitizeActivityInputs(activity));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<Location | null>(null);
  const [pendingLocationSource, setPendingLocationSource] = useState<'org' | 'location' | null>(null);
  const [locationSaveState, setLocationSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Always track latest formData so onBlur handlers don't capture stale closure values
  const latestFormData = useRef(formData)
  latestFormData.current = formData
  const handleBlurSave = () => onSaveDraft(latestFormData.current)

  const parsed = parseRrule(activity.repeat_rrule)
  const parsedMonthly = parsed.frequency === 'monthly' && parsed.days[0] ? parsePositionalDay(parsed.days[0]) : null
  const [repeatFrequency, setRepeatFrequency] = useState<string>(parsed.frequency ?? '')
  const [repeatDays, setRepeatDays] = useState<string[]>(
    (parsed.frequency === 'weekly' || parsed.frequency === 'biweekly') ? parsed.days : []
  )
  const [repeatUntil, setRepeatUntil] = useState<string>(() => {
    // Only pre-fill until if it's meaningfully after the start_date (not just the event's own end date)
    if (!parsed.untilDate || !activity.start_date) return parsed.untilDate
    return parsed.untilDate > activity.start_date ? parsed.untilDate : ''
  })
  const [repeatMonthlyPos, setRepeatMonthlyPos] = useState<string>(parsedMonthly ? String(parsedMonthly.pos) : '')
  const [repeatMonthlyDay, setRepeatMonthlyDay] = useState<string>(parsedMonthly ? parsedMonthly.abbr : '')
  const [deriveDate, setDeriveDate] = useState<string>('')

  const DOW_TO_ABBR = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

  const handleDeriveRrule = () => {
    const dateStr = deriveDate || repeatNextDate
    if (!dateStr) return
    const [y, m, day] = dateStr.split('-').map(Number)
    const d = new Date(y, m - 1, day)
    const abbr = DOW_TO_ABBR[d.getDay()]
    const effectiveFreq = repeatFrequency || 'weekly'
    setRepeatFrequency(effectiveFreq)
    if (effectiveFreq === 'weekly' || effectiveFreq === 'biweekly') {
      setRepeatDays([abbr])
      setRepeatMonthlyPos(''); setRepeatMonthlyDay('')
    } else if (effectiveFreq === 'monthly') {
      const dayOfMonth = d.getDate()
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const isLast = dayOfMonth + 7 > daysInMonth
      const pos = isLast ? -1 : Math.ceil(dayOfMonth / 7)
      setRepeatMonthlyPos(String(pos)); setRepeatMonthlyDay(abbr)
      setRepeatDays([])
    } else {
      setRepeatDays([]); setRepeatMonthlyPos(''); setRepeatMonthlyDay('')
    }
  }

  const effectiveDays =
    repeatFrequency === 'monthly' && repeatMonthlyPos && repeatMonthlyDay
      ? [`${repeatMonthlyPos}${repeatMonthlyDay}`]
      : (repeatFrequency === 'weekly' || repeatFrequency === 'biweekly')
        ? repeatDays
        : []

  useEffect(() => {
    const rrule = buildRrule({ frequency: repeatFrequency, days: effectiveDays, untilDate: repeatUntil })
    setFormData(prev => ({
      ...prev,
      repeat_rrule: rrule || null,
      repeat_frequency: (repeatFrequency as RepeatFrequency) || null,
    }))
  }, [repeatFrequency, repeatDays, repeatUntil, repeatMonthlyPos, repeatMonthlyDay])

  const toggleRepeatDay = (abbr: string) => {
    setRepeatDays(prev =>
      prev.includes(abbr) ? prev.filter(d => d !== abbr) : [...prev, abbr]
    )
  }

  const repeatNextDate = computeNextDate(repeatFrequency, effectiveDays, '', formData.start_date)
  const rrulePreview = buildRrule({ frequency: repeatFrequency, days: effectiveDays, untilDate: repeatUntil })

  const [isMultiDay, setIsMultiDay] = useState(() => {
    const s = activity.start_date, e = activity.end_date
    return !!(s && e && e > s)
  })

  const handleMultiDayToggle = (on: boolean) => {
    setIsMultiDay(on)
    if (!on) handleChange('end_date', null)
    else if (!formData.end_date) handleChange('end_date', formData.start_date)
  }

  const blurbRef = useAutosizeTextArea(formData.newsletter_description);
  const rawDescRef = useAutosizeTextArea(formData.description);
  const notesRef = useAutosizeTextArea(formData.triage_notes || "");

  const handleChange = (field: keyof DeskActivity, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'organization' && value === 'Amsterdam Parent Project') {
        next.newsletter_highlight = true;
      }
      return next;
    });
  };

  const handleDateChange = (field: keyof DeskActivity, value: any) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };

      if (field === 'start_time' || field === 'end_time') {
        if (updated.start_time && updated.end_time) {
          const endDate = updated.end_date || updated.start_date;
          const start = new Date(`${updated.start_date}T${updated.start_time}`);
          const end = new Date(`${endDate}T${updated.end_time}`);
          if (end < start) updated.duration_minutes = 0;
          else updated.duration_minutes = Math.round((end.getTime() - start.getTime()) / 60000);
        }
      }

      if (field === 'duration_minutes') {
        const mins = parseInt(value) || 0;
        updated.duration_minutes = mins;
        if (updated.start_time && mins > 0) {
          const start = new Date(`${updated.start_date}T${updated.start_time}`);
          const end = new Date(start.getTime() + mins * 60000);
          updated.end_date = end.toISOString().split('T')[0];
          updated.end_time = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
        }
      }
      return updated;
    });
  };

  // Saved location helpers
  const hasExistingLocation = !!(formData.location || formData.neighborhood || formData.area)
  const applyLocation = (loc: Location) => {
    const next = {
      ...latestFormData.current,
      location: loc.address,
      neighborhood: loc.neighborhood ?? latestFormData.current.neighborhood,
      area: loc.area ?? latestFormData.current.area,
    }
    setFormData(next)
    onSaveDraft(next)
    setPendingLocation(null)
    setPendingLocationSource(null)
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

  const requestApplyLocation = (loc: Location, source: 'org' | 'location') => {
    if (hasExistingLocation) {
      setPendingLocation(loc)
      setPendingLocationSource(source)
    } else {
      applyLocation(loc)
    }
  }

  const displayImageUrl = formData.preview_url || formData.file_url;
  const descriptionStyle = "w-full text-sm leading-relaxed text-black border border-slate-200 p-3 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none overflow-hidden bg-blue-50/60 rounded-lg transition-colors";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
      <div className="relative w-full max-w-4xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>

        {activity.status === 'processing' && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 z-30">
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing</span>
          </div>
        )}

        {/* Header */}
        <div className={`sticky top-0 border-b border-slate-100 p-4 flex items-center justify-between z-20 ${readOnly ? 'bg-slate-500' : 'bg-blue-600'}`}>
          <div className="flex items-center gap-2">
            {readOnly ? <Archive size={18} className="text-white ml-3" /> : <Edit size={18} className="text-white ml-3" />}
            <span className="text-lg tracking-wide text-white font-bold pl-2 py-1 rounded">
              {readOnly ? `Archived ${activity.type}` : `Edit ${activity.type}`}
            </span>
          </div>
          <button onClick={onClose} className="p-2 text-white hover:text-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className={`p-4 md:p-8 space-y-6 md:space-y-8 pb-16 ${readOnly ? 'pointer-events-none select-none opacity-60' : ''}`}>

          {/* Primary content */}
          <section className="space-y-4">
            <Field label="Title">
              <input
                className="w-full text-2xl font-black tracking-tight border-none p-0 focus:ring-0 focus:outline-none text-slate-900"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                onBlur={handleBlurSave}
              />
            </Field>

            <Field label="Source URL">
              <div className="flex items-center gap-2">
                <input
                  value={formData.url ?? ''}
                  onChange={(e) => handleChange('url', e.target.value)}
                  onBlur={handleBlurSave}
                  placeholder="https://example.com/activity-details"
                  className={inputStyle + " font-mono text-blue-600"}
                />
                {formData.url && (
                  <a
                    href={formData.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-black whitespace-nowrap"
                  >
                    <ExternalLink size={13} /> Visit source
                  </a>
                )}
              </div>
            </Field>
            <Field label="Host Organization">
              <OrgCombobox
                value={formData.organization ?? ''}
                locations={locations}
                inputStyle={inputStyle}
                onChange={(val) => handleChange('organization', val)}
                onSelectLocation={(loc) => {
                  handleChange('organization', loc.name)
                  requestApplyLocation(loc, 'org')
                }}
                onBlur={handleBlurSave}
              />
            </Field>
            {pendingLocation && pendingLocationSource === 'org' && (
              <OverwriteConfirm
                loc={pendingLocation}
                onConfirm={() => applyLocation(pendingLocation)}
                onCancel={() => { setPendingLocation(null); setPendingLocationSource(null) }}
              />
            )}
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
                onChange={(e) => handleChange('newsletter_description', e.target.value)}
                onBlur={handleBlurSave}
                className={descriptionStyle}
                placeholder="Create a succinct newsletter snippet description..."
              />
            </Field>

            <Toggle
              label="Highlight in newsletter"
              icon={<Star size={14} className={formData.newsletter_highlight ? "fill-current text-amber-500" : "text-slate-400"} />}
              checked={!!formData.newsletter_highlight}
              onChange={(v) => { handleChange('newsletter_highlight', v); onSaveDraft({ ...formData, newsletter_highlight: v }) }}
            />

            <Field label="Last newsletter issue">
              <div className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}>{formData.newsletter_last ?? '—'}</div>
            </Field>
          </section>

          {/* Date & time — events only */}
          {formData.type === 'event' && (
          <section className="space-y-4 py-2">
            <div className="flex flex-row items-center gap-2 mb-2">
              <Clock size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">Date & time</h2>
              <div className="ml-auto">
                <Toggle
                  label="Multi-day"
                  checked={isMultiDay}
                  onChange={handleMultiDayToggle}
                />
              </div>
            </div>
            <div className={`grid gap-4 ${isMultiDay ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <Field label="Start Date">
                <DateInput value={formData.start_date ?? ''} onChange={(v) => handleDateChange('start_date', v)} onBlur={handleBlurSave} />
              </Field>
              {isMultiDay && (
                <Field label="End Date">
                  <DateInput value={formData.end_date ?? ''} onChange={(v) => handleDateChange('end_date', v)} onBlur={handleBlurSave} />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <Field label="Start Time">
                <TimeInput value={formData.start_time ?? ''} onChange={(v) => handleDateChange('start_time', v)} onBlur={handleBlurSave} />
              </Field>
              <Field label="End Time">
                <TimeInput value={formData.end_time ?? ''} onChange={(v) => handleDateChange('end_time', v)} onBlur={handleBlurSave} />
              </Field>
              <Field label="Duration (min)">
                <input type="number" value={formData.duration_minutes ?? 0} onChange={(e) => handleDateChange('duration_minutes', e.target.value)} onBlur={handleBlurSave} className={inputStyle} />
              </Field>
            </div>
            <Toggle
              label="Skip calendar"
              icon={<SkipForward size={14} className={formData.calendar_skip ? "text-orange-500" : "text-slate-400"} />}
              checked={!!formData.calendar_skip}
              onChange={(v) => { handleChange('calendar_skip', v); onSaveDraft({ ...formData, calendar_skip: v }) }}
            />
          </section>
          )}

          {/* Repeat */}
          {formData.type === 'event' && (
            <section className="space-y-4 py-2">
              <div className="flex flex-row items-center gap-2 mb-2">
                <RefreshCw size={18} className="text-slate-700" />
                <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">Repeat</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <Field label="Frequency">
                  <select
                    value={repeatFrequency}
                    onChange={(e) => {
                      const next = e.target.value
                      setRepeatFrequency(next)
                      if (next !== 'weekly' && next !== 'biweekly') {
                        setRepeatDays([])
                      } else if (formData.start_date) {
                        const [wy, wm, wd] = formData.start_date.split('-').map(Number)
                        setRepeatDays([DOW_TO_ABBR[new Date(wy, wm - 1, wd).getDay()]])
                      }
                      if (next !== 'monthly') {
                        setRepeatMonthlyPos(''); setRepeatMonthlyDay('')
                      } else if (formData.start_date) {
                        const [sy, sm, sd] = formData.start_date.split('-').map(Number)
                        const d = new Date(sy, sm - 1, sd)
                        const abbr = DOW_TO_ABBR[d.getDay()]
                        const dom = d.getDate()
                        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
                        const pos = dom + 7 > daysInMonth ? -1 : Math.ceil(dom / 7)
                        setRepeatMonthlyPos(String(pos)); setRepeatMonthlyDay(abbr)
                      }
                    }}
                    onBlur={handleBlurSave}
                    className={selectStyle}
                  >
                    <option value="">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </Field>
                <Field label="Next occurrence">
                  <div className="flex gap-2">
                    <DateInput
                      value={deriveDate || repeatNextDate || ''}
                      onChange={setDeriveDate}
                      onBlur={handleBlurSave}
                    />
                    <button
                      type="button"
                      onClick={handleDeriveRrule}
                      disabled={!(deriveDate || repeatNextDate)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors text-xs font-black whitespace-nowrap"
                    >
                      <RefreshCw size={12} /> Derive
                    </button>
                  </div>
                </Field>
              </div>

              {repeatFrequency === 'monthly' && (
                <Field label="On">
                  <div className="flex gap-2">
                    <select
                      value={repeatMonthlyPos}
                      onChange={(e) => setRepeatMonthlyPos(e.target.value)}
                      onBlur={handleBlurSave}
                      className={selectStyle}
                    >
                      <option value="">Day of month</option>
                      <option value="1">1st</option>
                      <option value="2">2nd</option>
                      <option value="3">3rd</option>
                      <option value="4">4th</option>
                      <option value="-1">Last</option>
                    </select>
                    {repeatMonthlyPos && (
                      <select
                        value={repeatMonthlyDay}
                        onChange={(e) => setRepeatMonthlyDay(e.target.value)}
                        onBlur={handleBlurSave}
                        className={selectStyle}
                      >
                        <option value="">Weekday</option>
                        {WEEKDAYS.map(({ label, abbr }) => (
                          <option key={abbr} value={abbr}>{label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </Field>
              )}

              {(repeatFrequency === 'weekly' || repeatFrequency === 'biweekly') && (
                <Field label="Days of week">
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEKDAYS.map(({ label, abbr }) => (
                      <button
                        key={abbr}
                        type="button"
                        onClick={() => toggleRepeatDay(abbr)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide transition-colors ${
                          repeatDays.includes(abbr)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {repeatFrequency && (
                <Field label="Repeat ends (until date)">
                  <DateInput value={repeatUntil} onChange={setRepeatUntil} onBlur={handleBlurSave} />
                </Field>
              )}

              {rrulePreview && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-green-600 font-black uppercase tracking-widest">RRULE</span>
                  <code className="text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg font-mono break-all">{rrulePreview}</code>
                </div>
              )}
            </section>
          )}

          {/* Location */}
          <section className="space-y-4">
            <div className="flex flex-row items-center gap-2 mb-2">
              <MapPin size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">Location</h2>
              {locations.length > 0 && (
                <div className="ml-auto">
                  <select
                    className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[180px]"
                    value=""
                    onChange={(e) => {
                      const loc = locations.find(l => l.id === e.target.value)
                      if (loc) requestApplyLocation(loc, 'location')
                    }}
                  >
                    <option value="">Apply saved location…</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {pendingLocation && pendingLocationSource === 'location' && (
              <OverwriteConfirm
                loc={pendingLocation}
                onConfirm={() => applyLocation(pendingLocation)}
                onCancel={() => { setPendingLocation(null); setPendingLocationSource(null) }}
              />
            )}

            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <Field label="Area">
                <select value={formData.area ?? ''} onChange={(e) => handleChange('area', e.target.value)} onBlur={handleBlurSave} className={selectStyle}>
                  <option value="" disabled>Select area</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Neighborhood">
                <input value={formData.neighborhood ?? ''} onChange={(e) => handleChange('neighborhood', e.target.value)} onBlur={handleBlurSave} className={inputStyle} />
              </Field>
            </div>
            <div className="grid gap-4">
              <Field label="Address">
                <input value={formData.location ?? ''} onChange={(e) => handleChange('location', e.target.value)} onBlur={handleBlurSave} className={inputStyle} />
              </Field>
            </div>

            {formData.organization && formData.location && (
              <button
                type="button"
                onClick={handleSaveToLocations}
                disabled={locationSaveState === 'saving'}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50
                  bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600"
              >
                {locationSaveState === 'saved'
                  ? <><Check size={12} /> Saved</>
                  : <><BookmarkPlus size={12} /> Save to locations</>
                }
              </button>
            )}
          </section>

          {/* Details */}
          <section className="space-y-4">
            <div className="flex flex-row items-center gap-2 mb-2">
              <NotebookPen size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">Details</h2>
            </div>
            <Field label="Target Age Range">
              <input value={formData.age_range ?? ''} onChange={(e) => handleChange('age_range', e.target.value)} onBlur={handleBlurSave} className={inputStyle} />
            </Field>
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
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">Image</h2>
              <p className="text-sm text-slate-400 italic">Used on the website for APP events</p>
            </div>
            <Field label="Image URL">
              <input
                value={formData.file_url ?? ''}
                onChange={(e) => handleChange('file_url', e.target.value)}
                onBlur={handleBlurSave}
                placeholder="https://..."
                className={inputStyle + " font-mono text-xs"}
              />
            </Field>
            {displayImageUrl && (
              <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-96 flex justify-center items-center">
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
              <h2 className="text-slate-700 text-base md:text-xl font-black whitespace-nowrap">Triage</h2>
            </div>

            <Field label="Status">
              <select
                value={formData.status}
                onChange={e => {
                  const s = e.target.value as TriageStatus
                  if (s === 'snoozed' && publishDate) {
                    const d = new Date(publishDate)
                    d.setDate(d.getDate() + 1)
                    const next = { ...latestFormData.current, status: 'snoozed' as const, snooze_until: d.toISOString().split('T')[0] }
                    setFormData(next)
                    onSaveDraft(next)
                  } else {
                    const next = { ...latestFormData.current, status: s, snooze_until: s !== 'snoozed' ? null : latestFormData.current.snooze_until }
                    setFormData(next)
                    onSaveDraft(next)
                  }
                }}
                className={`w-full rounded-lg py-2 px-3 text-sm font-black uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors border-0 ${STATUS_COLORS[formData.status as TriageStatus] ?? 'bg-slate-100 text-slate-500'}`}
              >
                {TRIAGE_STATUSES.map(s => (
                  <option key={s} value={s}>{s === 'snoozed' ? 'Snoozed' : s}</option>
                ))}
              </select>
            </Field>

            {formData.snooze_until && (
              <Field label="Snoozed until">
                <div className={`${inputStyle} bg-amber-50 text-amber-700 border-amber-200`}>{formData.snooze_until}</div>
              </Field>
            )}

            <div className="flex flex-row items-center gap-2 mb-2">
              <Field label="Record id">
                <div className={`${inputStyle} bg-amber-50 text-amber-700 border-amber-200`}>{formData.id ?? 'No id'}</div>
              </Field>
            </div>

            <Field label="Source">
              <select value={formData.source} onChange={(e) => handleChange('source', e.target.value)} onBlur={handleBlurSave} className={selectStyle}>
                <option value="app_desk">APP Desk</option>
                <option value="app_website">APP Website</option>
                <option value="manual">Manual</option>
              </select>
            </Field>

            <Field label="In list">
              <div className="flex flex-wrap gap-1.5">
                {ALL_LISTS.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      const next = { ...latestFormData.current, list_id: l.id as ListId }
                      setFormData(next)
                      onSaveDraft(next)
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide transition-colors ${
                      formData.list_id === l.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <Field label="Created">
                <div className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}>
                  {formData.created_at ? new Date(formData.created_at).toLocaleString('en-GB') : '—'}
                </div>
              </Field>
              <Field label="Last edited">
                <div className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}>
                  {formData.updated_at ? new Date(formData.updated_at).toLocaleString('en-GB') : '—'}
                </div>
              </Field>
            </div>

            {formData.type === 'event' && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Added to calendar</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formData.calendar_sent ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {formData.calendar_sent ? 'Yes' : 'No'}
                </span>
              </div>
            )}

            <textarea
              ref={notesRef}
              value={formData.triage_notes || ""}
              onChange={(e) => handleChange('triage_notes', e.target.value)}
              onBlur={handleBlurSave}
              className="w-full text-sm leading-relaxed text-black border border-amber-200 p-3 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none overflow-hidden bg-amber-50/80 rounded-lg transition-colors"
              placeholder="Add administrative context notes here..."
            />

            {onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-red-600">Are you sure?</span>
                  <button
                    type="button"
                    onClick={() => { onDelete(formData.id, formData.type); onClose(); }}
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
                  className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                >
                  <Trash2 size={13} /> Delete record permanently
                </button>
              )
            )}
          </section>

        </div>

        {/* Footer actions */}
        {readOnly ? (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20 flex gap-3">
            {onRestore && (
              <button
                onClick={() => { onRestore(); onClose(); }}
                className="flex-1 bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                <RotateCcw size={18} strokeWidth={3} /> Restore
              </button>
            )}
            {onDelete && (
              confirmDelete ? (
                <div className="flex-1 flex items-center gap-2">
                  <button
                    onClick={() => { onDelete(formData.id, formData.type); onClose(); }}
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
                  className="flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-2xl transition-colors"
                >
                  <Trash2 size={18} strokeWidth={3} /> Delete forever
                </button>
              )
            )}
          </div>
        ) : ((onSendToAI && getListTab(formData.list_id) === 'triage') || !!ALL_LISTS.find(l => l.id === formData.list_id)?.finishLabel) && (
          <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20 flex gap-4">
            {onSendToAI && getListTab(formData.list_id) === 'triage' && (
              <button onClick={() => onSendToAI(formData)} className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                <Sparkles size={18} strokeWidth={3} /> Send to AI
              </button>
            )}
            {ALL_LISTS.find(l => l.id === formData.list_id)?.finishLabel && (
              <button onClick={() => onFinishEditing(formData)} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                <Check size={18} strokeWidth={3} />
                {ALL_LISTS.find(l => l.id === formData.list_id)?.finishLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DateInput({ value, onChange, onBlur }: { value: string, onChange: (v: string) => void, onBlur?: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button type="button" tabIndex={-1} onClick={() => ref.current?.showPicker()}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10">
        <Calendar size={14} />
      </button>
      <input ref={ref} type="date" value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
        className={`${inputStyle} pl-8 [&::-webkit-calendar-picker-indicator]:hidden`} />
    </div>
  )
}

function TimeInput({ value, onChange, onBlur }: { value: string, onChange: (v: string) => void, onBlur?: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button type="button" tabIndex={-1} onClick={() => ref.current?.showPicker()}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10">
        <Clock size={14} />
      </button>
      <input ref={ref} type="time" lang="nl" value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur}
        className={`${inputStyle} pl-8 [&::-webkit-calendar-picker-indicator]:hidden`} />
    </div>
  )
}

function OverwriteConfirm({ loc, onConfirm, onCancel }: { loc: Location, onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <span className="text-amber-800 font-bold flex-1">
        Overwrite existing location with <span className="italic">{loc.name}</span>?
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

function OrgCombobox({ value, locations, inputStyle, onChange, onSelectLocation, onBlur }: {
  value: string
  locations: Location[]
  inputStyle: string
  onChange: (val: string) => void
  onSelectLocation: (loc: Location) => void
  onBlur: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = locations.filter(loc =>
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
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        className={inputStyle}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(loc => (
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
                <span className="text-slate-400 text-xs truncate">{loc.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string, children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] text-green-600 font-black uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, icon, checked, onChange }: { label: string, icon?: ReactNode, checked: boolean, onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 px-1 py-0.5"
    >
      <div className={`relative inline-flex h-6 w-16 items-center rounded-full transition-colors ${checked ? 'bg-amber-400' : 'bg-slate-200'}`}>
        <span className={`absolute text-[9px] font-black uppercase tracking-wider transition-all ${checked ? 'left-2 text-white' : 'right-2 text-slate-400'}`}>
          {checked ? 'YES' : 'NO'}
        </span>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-10' : 'translate-x-1'}`} />
      </div>
      <div className={`flex items-center gap-2 transition-colors ${checked ? 'text-amber-500' : 'text-slate-400'}`}>
        {icon}
        <span className={`text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${checked ? 'text-amber-500' : 'text-slate-500'}`}>{label}</span>
      </div>
    </button>
  )
}
