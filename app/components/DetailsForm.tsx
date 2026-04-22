// components/DetailsForm.tsx
'use client'
import { useState, useMemo } from 'react'

export function DetailsForm({ event, onSave, onClose }) {
  // Local state for the form so we don't spam the DB with every keystroke
  const [formData, setFormData] = useState(event);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="font-bold text-xl uppercase tracking-tighter">Edit Event</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full">✕</button>
        </div>

        <form className="space-y-6 pb-20">
          <Field label="Title" value={formData.title} 
            onChange={(v) => setFormData({...formData, title: v})} />
            
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Newsletter Blurb</label>
            <textarea 
              className="w-full text-sm border-slate-200 rounded-md bg-slate-50 h-48 p-2"
              placeholder={event.newsletterDescription}
              value={formData.newsletterDescription}
              onChange={(e) => setFormData({...formData, newsletterDescription: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" value={formData.startDate} 
              onChange={(v) => setFormData({...formData, startDate: v})} />
            <Field label="End Date" value={formData.endDate} 
              onChange={(v) => setFormData({...formData, endDate: v})} />
          </div>

          {/* ... Add all other fields (Age, Neighborhood, etc) ... */}
          
          <button 
            type="button"
            onClick={() => onSave(formData)}
            className="fixed bottom-6 right-6 left-6 bg-slate-900 text-white font-bold py-4 rounded-xl shadow-2xl"
          >
            SAVE CHANGES
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
      <input 
        className="w-full text-sm border-b border-slate-200 py-2 focus:border-blue-500 outline-none"
        placeholder={value}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}