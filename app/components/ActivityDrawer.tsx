// components/ActivityDrawer.tsx
import { ReactNode, useEffect, useRef, useState } from 'react'
import { X, MapPin, ExternalLink, Save, Clock, Star, NotebookPen, Edit, Check, ImageIcon, SkipForward, RefreshCw, Calendar } from 'lucide-react'
import { DeskActivity, DEFAULT_DESK_ACTIVITY, RepeatFrequency } from '../types/activity'
import { ALL_LISTS } from '../types/list'
import { useAutosizeTextArea } from "../hooks/useAutosizeTextArea";
import { parseRrule, buildRrule, computeNextDate, parsePositionalDay } from '../utils/rrule';

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

export function ActivityDrawer({ activity, onSaveDraft, onFinishEditing, onClose }: ActivityDrawerProps) {
  const [formData, setFormData] = useState<DeskActivity>(() => sanitizeActivityInputs(activity));

  const parsed = parseRrule(activity.repeat_rrule)
  const parsedMonthly = parsed.frequency === 'monthly' && parsed.days[0] ? parsePositionalDay(parsed.days[0]) : null
  const [repeatFrequency, setRepeatFrequency] = useState<string>(parsed.frequency ?? '')
  const [repeatDays, setRepeatDays] = useState<string[]>(parsed.frequency === 'weekly' ? parsed.days : [])
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
    if (effectiveFreq === 'weekly') {
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
      : repeatFrequency === 'weekly'
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

  const displayImageUrl = formData.preview_url || formData.file_url;
  const descriptionStyle = "w-full text-sm leading-relaxed text-black border border-slate-200 p-3 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 resize-none overflow-hidden bg-blue-50/60 rounded-lg transition-colors";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-4xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="sticky top-0 bg-blue-600 border-b border-slate-100 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <Edit size={18} className="text-white ml-3" />
            <span className="text-lg tracking-wide text-white font-bold pl-2 py-1 rounded">
              Edit activity
            </span>
          </div>
          <button onClick={onClose} className="p-2 text-white hover:text-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 pb-16">

          {/* Primary content */}
          <section className="space-y-4">
            <Field label="Title">
              <input
                className="w-full text-2xl font-black tracking-tight border-none p-0 focus:ring-0 focus:outline-none text-slate-900"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </Field>

            <Field label="Source URL">
              <div className="flex items-center gap-2">
                <input
                  value={formData.url ?? ''}
                  onChange={(e) => handleChange('url', e.target.value)}
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
              <input value={formData.organization ?? ''} onChange={(e) => handleChange('organization', e.target.value)} className={inputStyle} />
            </Field>
            {formData.organization === 'Amsterdam Parent Project' && (
              <Field label="Website tagline">
                <input
                  value={formData.tagline ?? ''}
                  onChange={(e) => handleChange('tagline', e.target.value)}
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
                className={descriptionStyle}
                placeholder="Create a succinct newsletter snippet description..."
              />
            </Field>

            <Toggle
              label="Highlight in newsletter"
              icon={<Star size={14} className={formData.newsletter_highlight ? "fill-current text-amber-500" : "text-slate-400"} />}
              checked={!!formData.newsletter_highlight}
              onChange={(v) => handleChange('newsletter_highlight', v)}
            />
          </section>

          {/* Date & time */}
          <section className="space-y-4 py-2">
            <div className="flex flex-row items-center gap-2 mb-2">
              <Clock size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Date & time</h2>
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
                <DateInput value={formData.start_date ?? ''} onChange={(v) => handleDateChange('start_date', v)} />
              </Field>
              {isMultiDay && (
                <Field label="End Date">
                  <DateInput value={formData.end_date ?? ''} onChange={(v) => handleDateChange('end_date', v)} />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Start Time">
                <TimeInput value={formData.start_time ?? ''} onChange={(v) => handleDateChange('start_time', v)} />
              </Field>
              <Field label="End Time">
                <TimeInput value={formData.end_time ?? ''} onChange={(v) => handleDateChange('end_time', v)} />
              </Field>
              <Field label="Duration (min)">
                <input type="number" value={formData.duration_minutes ?? 0} onChange={(e) => handleDateChange('duration_minutes', e.target.value)} className={inputStyle} />
              </Field>
            </div>

            {formData.type === 'event' && (
              <Toggle
                label="Skip calendar"
                icon={<SkipForward size={14} className={formData.calendar_skip ? "text-orange-500" : "text-slate-400"} />}
                checked={!!formData.calendar_skip}
                onChange={(v) => handleChange('calendar_skip', v)}
              />
            )}
          </section>

          {/* Repeat */}
          {formData.type === 'event' && (
            <section className="space-y-4 py-2">
              <div className="flex flex-row items-center gap-2 mb-2">
                <RefreshCw size={18} className="text-slate-700" />
                <h2 className="text-slate-700 text-xl font-black">Repeat</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Frequency">
                  <select
                    value={repeatFrequency}
                    onChange={(e) => {
                      const next = e.target.value
                      setRepeatFrequency(next)
                      if (next !== 'weekly') {
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
                    className={selectStyle}
                  >
                    <option value="">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </Field>
                <Field label="Next occurrence">
                  <div className="flex gap-2">
                    <DateInput
                      value={deriveDate || repeatNextDate || ''}
                      onChange={setDeriveDate}
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

              {repeatFrequency === 'weekly' && (
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
                  <DateInput value={repeatUntil} onChange={setRepeatUntil} />
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
              <h2 className="text-slate-700 text-xl font-black">Location</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Area">
                <select value={formData.area ?? ''} onChange={(e) => handleChange('area', e.target.value)} className={selectStyle}>
                  <option value="" disabled>Select area</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Neighborhood">
                <input value={formData.neighborhood ?? ''} onChange={(e) => handleChange('neighborhood', e.target.value)} className={inputStyle} />
              </Field>
            </div>
            <div className="grid gap-4">
              <Field label="Address">
                <input value={formData.location ?? ''} onChange={(e) => handleChange('location', e.target.value)} className={inputStyle} />
              </Field>
            </div>
          </section>

          {/* Details */}
          <section className="space-y-4">
            <div className="flex flex-row items-center gap-2 mb-2">
              <NotebookPen size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Details</h2>
            </div>
            <Field label="Target Age Range">
              <input value={formData.age_range ?? ''} onChange={(e) => handleChange('age_range', e.target.value)} className={inputStyle} />
            </Field>
            <Field label="Description">
              <textarea
                ref={rawDescRef}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className={descriptionStyle}
                placeholder="Full text scraped or transcribed from original source submission..."
              />
            </Field>
          </section>

          {/* Image */}
          <section className="space-y-3">
            <div className="flex flex-row items-center gap-2 mb-2">
              <ImageIcon size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Image</h2>
              <p className="text-sm text-slate-400 italic">Used on the website for APP events</p>
            </div>
            <Field label="Image URL">
              <input
                value={formData.file_url ?? ''}
                onChange={(e) => handleChange('file_url', e.target.value)}
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

          {/* Triage notes */}
          <section className="space-y-3">
            <div className="flex flex-row items-center gap-2 mb-2">
              <NotebookPen size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Triage notes</h2>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Added to calendar</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${formData.calendar_sent ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                {formData.calendar_sent ? 'Yes' : 'No'}
              </span>
            </div>
            <textarea
              ref={notesRef}
              value={formData.triage_notes || ""}
              onChange={(e) => handleChange('triage_notes', e.target.value)}
              className="w-full text-sm leading-relaxed text-black border border-amber-200 p-3 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none overflow-hidden bg-amber-50/80 rounded-lg transition-colors"
              placeholder="Add administrative context notes here..."
            />
          </section>

        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20 flex gap-4">
          <button onClick={() => onSaveDraft(formData)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Save size={18} strokeWidth={3} /> Save draft
          </button>
          {ALL_LISTS.find(l => l.id === formData.list_id)?.finishLabel && (
            <button onClick={() => onFinishEditing(formData)} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
              <Check size={18} strokeWidth={3} />
              {ALL_LISTS.find(l => l.id === formData.list_id)?.finishLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DateInput({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button type="button" tabIndex={-1} onClick={() => ref.current?.showPicker()}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10">
        <Calendar size={14} />
      </button>
      <input ref={ref} type="date" value={value} onChange={e => onChange(e.target.value)}
        className={`${inputStyle} pl-8 [&::-webkit-calendar-picker-indicator]:hidden`} />
    </div>
  )
}

function TimeInput({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button type="button" tabIndex={-1} onClick={() => ref.current?.showPicker()}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10">
        <Clock size={14} />
      </button>
      <input ref={ref} type="time" lang="nl" value={value} onChange={e => onChange(e.target.value)}
        className={`${inputStyle} pl-8 [&::-webkit-calendar-picker-indicator]:hidden`} />
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
        <span className={`text-sm font-bold transition-colors ${checked ? 'text-amber-500' : 'text-slate-500'}`}>{label}</span>
      </div>
    </button>
  )
}
