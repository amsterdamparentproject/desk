// components/ActivityDrawer.tsx
import { ReactNode } from 'react'
import { useState } from 'react'
import { X, MapPin, ExternalLink, Save, Clock, Star, NotebookPen, Edit, Check, ImageIcon, SkipForward } from 'lucide-react'
import { DeskActivity, DEFAULT_DESK_ACTIVITY } from '../types/activity'
import { useAutosizeTextArea } from "../hooks/useAutosizeTextArea";

const AREAS = ['West', 'East', 'North', 'Center', 'South', 'Everywhere', 'Online']

const inputStyle = "w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-colors bg-white"
const selectStyle = `${inputStyle} cursor-pointer`

export function sanitizeActivityInputs(activity: DeskActivity): DeskActivity {
  const cleanIncomingFields = Object.entries(activity).reduce<Record<string, any>>((acc, [key, value]) => {
    if (value !== null) acc[key] = value;
    return acc;
  }, {});
  return { ...DEFAULT_DESK_ACTIVITY, ...cleanIncomingFields } as DeskActivity;
}

interface ActivityDrawerProps {
  activity: DeskActivity,
  onSaveDraft: (data: DeskActivity) => void,
  onFinishEditing: (data: DeskActivity) => void,
  onClose: () => void,
}

export function ActivityDrawer({ activity, onSaveDraft, onFinishEditing, onClose }: ActivityDrawerProps) {
  const [formData, setFormData] = useState<DeskActivity>(() => sanitizeActivityInputs(activity));

  const blurbRef = useAutosizeTextArea(formData.newsletter_description);
  const rawDescRef = useAutosizeTextArea(formData.description);
  const notesRef = useAutosizeTextArea(formData.triage_notes || "");

  const handleChange = (field: keyof DeskActivity, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: keyof DeskActivity, value: any) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };

      if (field === 'start_date') updated.end_date = value;

      if (field === 'start_time' || field === 'end_time') {
        if (updated.start_time && updated.end_time) {
          const start = new Date(`${updated.start_date}T${updated.start_time}`);
          const end = new Date(`${updated.end_date}T${updated.end_time}`);
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date">
                <input type="date" value={formData.start_date} onChange={(e) => handleDateChange('start_date', e.target.value)} className={inputStyle} />
              </Field>
              <Field label="End Date">
                <input type="date" value={formData.end_date ?? ''} onChange={(e) => handleDateChange('end_date', e.target.value)} className={inputStyle} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Start Time">
                <input type="time" value={formData.start_time ?? ''} onChange={(e) => handleDateChange('start_time', e.target.value)} className={inputStyle} />
              </Field>
              <Field label="End Time">
                <input type="time" value={formData.end_time ?? ''} onChange={(e) => handleDateChange('end_time', e.target.value)} className={inputStyle} />
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Host Organization">
                <input value={formData.organization ?? ''} onChange={(e) => handleChange('organization', e.target.value)} className={inputStyle} />
              </Field>
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
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20 grid grid-cols-2 gap-4">
          <button onClick={() => onSaveDraft(formData)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Save size={18} strokeWidth={3} /> Save draft
          </button>
          <button onClick={() => onFinishEditing(formData)} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Check size={18} strokeWidth={3} /> Finish editing
          </button>
        </div>
      </div>
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
      className="flex items-center justify-between w-full px-1 py-0.5"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-bold text-slate-700">{label}</span>
      </div>
      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-slate-200'}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}
