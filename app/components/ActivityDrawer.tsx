// components/DetailsForm.tsx
import { useState, ReactNode, useEffect } from 'react'
import { X, Calendar, MapPin, ExternalLink, Save, Clock, Star, NotebookPen, Edit, Check, ImageIcon } from 'lucide-react'
import { DeskActivity } from '../types/activity' // Adjust paths based on your architecture
import { useAutosizeTextArea } from "../hooks/useAutosizeTextArea";

const AREAS = ['West', 'East', 'North', 'Center', 'South', 'Everywhere', 'Online']

/**
 * Sanitizes a DeskActivity object to ensure no null values break controlled React inputs or array loops.
 */
function sanitizeActivityInputs(activity: DeskActivity): DeskActivity {
  // Define fields that require specific primitive/structural defaults
  const numberFields = ['duration_minutes'];
  const booleanFields = ['calendar_skip', 'calendar_sent', 'newsletter_highlight'];
  const arrayFields = ['categories'];

  const sanitized = Object.entries(activity).reduce((acc, [key, value]) => {
    // If the value is completely valid, keep it
    if (value !== null && value !== undefined) {
      acc[key] = value;
    } 
    // Fallbacks for null/undefined database values
    else if (numberFields.includes(key)) {
      acc[key] = 0;
    } else if (booleanFields.includes(key)) {
      acc[key] = false;
    } else if (arrayFields.includes(key)) {
      acc[key] = [];
    } else {
      acc[key] = '';
    }
    return acc;
  }, {} as any);

  return sanitized as DeskActivity;
}

interface ActivityDrawerProps {
    activity: DeskActivity, 
    onSave: (data: DeskActivity) => void, 
    onClose: () => void,
}

export function ActivityDrawer({ activity, onSave, onClose }: ActivityDrawerProps) {
  // SANITIZE: Ensure no database null values break controlled React text inputs
  // Find your useState block and update these properties to fallback to ""
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
          let end = new Date(`${updated.end_date}T${updated.end_time}`);
          if (end < start) updated.duration_minutes = 0;
          else {
            const diffMs = end.getTime() - start.getTime();
            updated.duration_minutes = Math.round(diffMs / 60000);
          }
        }
      }

      if (field === 'duration_minutes') {
        const mins = parseInt(value) || 0;
        updated.duration_minutes = mins;
        if (updated.start_time && mins > 0) {
          const start = new Date(`${updated.start_date}T${updated.start_time}`);
          const end = new Date(start.getTime() + mins * 60000);
          updated.end_date = end.toISOString().split('T')[0];
          const hh = String(end.getHours()).padStart(2, '0');
          const mm = String(end.getMinutes()).padStart(2, '0');
          updated.end_time = `${hh}:${mm}`;
        }
      }
      return updated;
    });
  };

  // Dual-source image prioritizing the instant local preview blob before falling back to permanent Supabase URL
  const displayImageUrl = formData.preview_url || formData.file_url;

  const descriptionStyle = "w-full text-sm leading-relaxed text-black border-none p-3 focus:ring-0 resize-none overflow-hidden bg-blue-50/80 rounded-lg";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-4xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-blue-600 border-b border-slate-100 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <Edit size={18} className="text-white ml-3" />
            <span className="text-lg tracking-wide text-white font-bold pl-2 py-1 rounded">
              Triage & Edit Activity
            </span>
          </div>
          <button onClick={onClose} className="p-2 text-white hover:text-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 pb-16">

          {/* Attached Files & Screenshots */}
          {displayImageUrl && (
            <section className="space-y-2">
              <div className="flex flex-row items-center gap-2 mb-2">
                <ImageIcon size={18} className="text-slate-700" />
                <h2 className="text-slate-700 text-xl font-black">Attached Document</h2>
              </div>
              <div className="relative border rounded-xl overflow-hidden bg-slate-50 max-h-96 flex justify-center items-center">
                <img 
                  src={displayImageUrl} 
                  alt="Submission original source" 
                  className="max-h-96 w-full object-contain"
                />
                {formData.preview_url && (
                  <div className="absolute top-3 right-3 bg-blue-600 text-white text-[10px] font-black px-2 py-1 uppercase rounded shadow">
                    Local Preview (Syncing...)
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Primary content */}
          <section className="space-y-4">
            <Field label="Title">
              <input 
                className="w-full text-2xl font-black tracking-tight border-none p-0 focus:ring-0 text-slate-900"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </Field>
            
            <Field label="Source URL">
              <div className="flex items-center gap-2">
                {formData.url && (
                  <a href={formData.url} target="_blank" rel="noreferrer" className="p-2 bg-slate-50 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                    <ExternalLink size={14} />
                  </a>
                )}
                <input 
                  value={formData.url} 
                  onChange={(e) => handleChange('url', e.target.value)} 
                  placeholder="https://example.com/activity-details"
                  className="w-full text-xs font-mono text-blue-500 border-none p-0 focus:ring-0 truncate" 
                />
              </div>
            </Field>

            <Field label="Newsletter blurb summary">
                <textarea 
                    ref={blurbRef}
                    value={formData.newsletter_description}
                    onChange={(e) => handleChange('newsletter_description', e.target.value)}
                    className={descriptionStyle}
                    placeholder="Create a succinct newsletter snippet description..."
                />
            </Field>

            <CheckboxField 
              checkedLabel="Highlighted in Newsletter Features" 
              uncheckedLabel="Standard Newsletter Placement"
              icon={<Star size={14} className={formData.newsletter_highlight ? "fill-current" : ""}/>}
              checked={formData.newsletter_highlight}
              onChange={(value: boolean) => handleChange('newsletter_highlight', value)}
            />
          </section>

          {/* Date & time */}
          <section className="space-y-2 py-2">
            <div className="flex flex-row items-center gap-2 mb-4">
              <Clock size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Date & time</h2>
            </div>
             <div className="grid grid-cols-2 gap-8 pb-2">
              <Field label="Start Date">
                <input type="date" value={formData.start_date} onChange={(e) => handleDateChange('start_date', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="End Date">
                <input type="date" value={formData.end_date} onChange={(e) => handleDateChange('end_date', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-8 pb-2">
              <Field label="Start Time">
                <input type="time" value={formData.start_time} onChange={(e) => handleDateChange('start_time', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="End Time">
                <input type="time" value={formData.end_time} onChange={(e) => handleDateChange('end_time', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="Duration (Minutes)">
                <input type="number" value={formData.duration_minutes} onChange={(e) => handleDateChange('duration_minutes', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
          </section>

          {/* Location */}
          <section className="space-y-8">
            <div className="flex flex-row items-center gap-2 mb-4">
              <MapPin size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Location Mapping</h2>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <Field label="Area">
                <select value={formData.area} onChange={(e) => handleChange('area', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0 bg-transparent cursor-pointer">
                  <option value="" disabled>Select Area</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Neighborhood">
                <input value={formData.neighborhood} onChange={(e) => handleChange('neighborhood', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
            <Field label="Specific Venue/Location Address">
              <input value={formData.location} onChange={(e) => handleChange('location', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
            </Field>
          </section>

          {/* Details */}
          <section className="space-y-8">
            <div className="flex flex-row items-center gap-2 mb-4">
              <NotebookPen size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Internal Operations</h2>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <Field label="Host Organization">
                <input value={formData.organization} onChange={(e) => handleChange('organization', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="Target Age Range">
                <input value={formData.age_range} onChange={(e) => handleChange('age_range', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
            
            <Field label="Original Capture / Source Raw Text Description">
                <textarea 
                  ref={rawDescRef}
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className={descriptionStyle}
                  placeholder="Full text scraped or transcribed from original source submission..."
                />
            </Field>

            <Field label="Internal Triage Work Notes">
                <textarea 
                  ref={notesRef}
                  value={formData.triage_notes || ""}
                  onChange={(e) => handleChange('triage_notes', e.target.value)}
                  className="w-full text-sm leading-relaxed text-black border-none p-3 focus:ring-0 resize-none overflow-hidden bg-amber-50/80 rounded-lg border border-amber-200"
                  placeholder="Add administrative context notes here (e.g. 'Waiting for organizer to email back confirmations')..."
                />
            </Field>
          </section>

        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20 grid grid-cols-2 gap-8">
          <button onClick={() => onSave(formData)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Save size={18} strokeWidth={3} /> Save Draft
          </button>
          <button onClick={() => onSave(formData)} className="w-full bg-green-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Check size={18} strokeWidth={3} /> Approve Triage
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, icon, extra, children }: { label: string, icon?: ReactNode, extra?: ReactNode, children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-400 group-focus-within:text-blue-500">
          {icon} <label className="text-[9px] text-green-600 font-black uppercase tracking-widest">{label}</label>
        </div>
        {extra}
      </div>
      <div className="group-focus-within:border-blue-500 transition-all py-1">
        {children}
      </div>
    </div>
  )
}

function CheckboxField({ checkedLabel, uncheckedLabel, icon, checked, onChange }: { checkedLabel: string, uncheckedLabel: string, checked: boolean | undefined, icon: ReactNode, onChange: Function }) {
  const inactiveColor = "bg-gray-100/50 text-slate-400 border-slate-100";
  const activeColor = "text-green-600 bg-green-100 border-green-200";
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex items-center justify-between w-full p-3 rounded-xl border transition-all text-left ${checked ? activeColor : inactiveColor}`}>
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`p-2 rounded-lg ${checked ? 'bg-white/50' : 'bg-slate-50'}`}>{icon}</div>
        <div className="overflow-hidden">
          <p className="text-sm font-bold leading-none">{ checked ? checkedLabel : uncheckedLabel }</p>
        </div>
      </div>
    </button>
  )
}