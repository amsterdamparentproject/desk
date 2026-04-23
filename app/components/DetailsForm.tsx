// components/DetailsForm.tsx
import { useState, useRef, useEffect, ReactNode } from 'react'
import { X, Calendar, MapPin, ExternalLink, Save, Clock, Star, NotebookPen } from 'lucide-react'
import { NewsletterEvent } from '../types/event'
import { useAutosizeTextArea } from "../hooks/useAutosizeTextArea";

const AREAS = ['West', 'East', 'North', 'Center', 'South', 'Everywhere', 'Online']
const FREQUENCIES = ['none', 'daily', 'weekly', 'monthly', 'annually']

export function DetailsForm({ event, onSave, onClose }: { event: NewsletterEvent, onSave: (data: NewsletterEvent) => void, onClose: () => void }) {
  // SANITIZE: Ensure no nulls hit the inputs
  const [formData, setFormData] = useState<NewsletterEvent>({
    ...event,
    area: event.area ?? "",
    repeatFrequency: event.repeatFrequency ?? "none",
    newsletterDescription: event.newsletterDescription ?? "",
    description: event.description ?? "",
    repeat: event.repeat ?? "",
  })

    const blurbRef = useAutosizeTextArea(formData.newsletterDescription);
    const rawDescRef = useAutosizeTextArea(formData.description);

  const handleChange = (field: keyof NewsletterEvent, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: keyof NewsletterEvent, value: any) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value };

      if (field === 'startDate') updated.endDate = value;

      if (field === 'startTime' || field === 'endTime') {
        if (updated.startTime && updated.endTime) {
          const start = new Date(`${updated.startDate}T${updated.startTime}`);
          let end = new Date(`${updated.endDate}T${updated.endTime}`);
          if (end < start) updated.duration = 0;
          else {
            const diffMs = end.getTime() - start.getTime();
            updated.duration = Math.round(diffMs / 60000);
          }
        }
      }

      if (field === 'duration') {
        const mins = parseInt(value) || 0;
        updated.duration = mins;
        if (updated.startTime && mins > 0) {
          const start = new Date(`${updated.startDate}T${updated.startTime}`);
          const end = new Date(start.getTime() + mins * 60000);
          updated.endDate = end.toISOString().split('T')[0];
          const hh = String(end.getHours()).padStart(2, '0');
          const mm = String(end.getMinutes()).padStart(2, '0');
          updated.endTime = `${hh}:${mm}`;
        }
      }
      return updated;
    });
  };

  const descriptionStyle = "w-full text-sm leading-relaxed text-black border-none p-3 focus:ring-0 resize-none overflow-hidden bg-blue-50/80 rounded-lg";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-4xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">
              {formData.list_id}
            </span>
            <h2 className="font-black text-xs uppercase tracking-widest text-slate-400">Editor</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8 pb-16">

          {/* Primary content */}
          <section className="space-y-4">
            <Field label="Title">
              <input 
                className="w-full text-2xl font-black tracking-tight border-none p-0 focus:ring-0 text-slate-900"
                value={formData.title || ""}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </Field>
            <Field label="Source URL">
              <div className="flex items-center gap-2">
                <a href={formData.url} target="_blank" rel="noreferrer" className="p-2 bg-slate-50 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"><ExternalLink size={14} /></a>
                <input value={formData.url || ""} onChange={(e) => handleChange('url', e.target.value)} className="w-full text-xs font-mono text-blue-500 border-none p-0 focus:ring-0 truncate" />
              </div>
            </Field>

            <Field label="Newsletter blurb">
                <textarea 
                    ref={blurbRef}
                    value={formData.newsletterDescription}
                    onChange={(e) => handleChange('newsletterDescription', e.target.value)}
                    className={descriptionStyle}
                    placeholder="Create a newsletter description"
                />
            </Field>
            <CheckboxField 
              checkedLabel="Highlight in APP & Friends" 
              uncheckedLabel="No highlight"
              icon={<Star size={14} className="fill-current"/>}
              checked={formData.is_highlight}
              onChange={(v) => handleChange('is_highlight', v)}
            />
          </section>

          {/* Date & time */}
          <section className="space-y-2 py-2">
            <div className="flex flex-row items-center gap-2 mb-4">
              <Clock size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Date & time</h2>
            </div>
             <div className="grid grid-cols-3 gap-8 pb-2">
              <Field label="Start Date">
                <input type="date" value={formData.startDate || ""} onChange={(e) => handleDateChange('startDate', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="End Date">
                <input type="date" value={formData.endDate || ""} onChange={(e) => handleDateChange('endDate', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-8 pb-2">
              <Field label="Start Time">
                <input type="time" value={formData.startTime || ""} onChange={(e) => handleDateChange('startTime', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="End Time">
                <input type="time" value={formData.endTime || ""} onChange={(e) => handleDateChange('endTime', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="Duration">
                <input type="number" value={formData.duration || 0} onChange={(e) => handleDateChange('duration', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4 items-end pb-2">
              <Field label="Repeat frequency">
                <select 
                    value={formData.repeatFrequency || ""} 
                    onChange={(e) => handleChange('repeatFrequency', e.target.value)}
                    className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0 bg-transparent capitalize cursor-pointer"
                >
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                </Field>
                <Field label="Repeat description">
                <input placeholder="Every first Sunday" value={formData.repeat || ""} onChange={(e) => handleChange('repeat', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
             <div>
                <CheckboxField 
                    checkedLabel="Add to Calendar" 
                    uncheckedLabel="Skip calendar"
                    icon={<Calendar size={14}/>}
                    checked={formData.add_to_calendar}
                    onChange={(v) => handleChange('add_to_calendar', v)}
                />
             </div>
          </section>

          {/* Location */}
          <section className="space-y-8 pt-8 border-t border-slate-100">
            <div className="flex flex-row items-center gap-2 mb-4">
              <MapPin size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Location</h2>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <Field label="Area">
                <select value={formData.area || ""} onChange={(e) => handleChange('area', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0 bg-transparent cursor-pointer">
                  <option value="" disabled>Select Area</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Neighborhood">
                <input value={formData.neighborhood || ""} onChange={(e) => handleChange('neighborhood', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
            <Field label="Location">
              <input value={formData.location || ""} onChange={(e) => handleChange('location', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
            </Field>
          </section>

          {/* Other */}
          <section className="space-y-8 pt-8 border-t border-slate-100">
            <div className="flex flex-row items-center gap-2 mb-4">
              <NotebookPen size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-xl font-black">Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <Field label="Organization">
                <input value={formData.organization || ""} onChange={(e) => handleChange('organization', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
              <Field label="Age range">
                <input value={formData.age || ""} onChange={(e) => handleChange('age', e.target.value)} className="w-full text-sm font-bold text-slate-700 border-none p-0 focus:ring-0" />
              </Field>
            </div>
            
            <Field label="Calendar description">
                <textarea 
                  ref={rawDescRef}
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className={descriptionStyle}
                  placeholder="Full description for the calendar event"
                />
            </Field>
          </section>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20">
          <button onClick={() => onSave(formData)} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
            <Save size={18} strokeWidth={3} /> Update Event
          </button>
        </div>
      </div>
    </div>
  )
}

// Sub-components kept identical for structure
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