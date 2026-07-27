// components/LocationDrawer.tsx
import { ReactNode, useState, useRef } from 'react'
import { useAutosizeTextArea } from '../hooks/useAutosizeTextArea'
import { X, MapPin, Edit, Check, ExternalLink, Globe, FileText, Tag, Mail, Trash2 } from 'lucide-react'
import { Location } from '../types/activity'
import { updateLocation } from '../actions/activities'

const AREAS = ['West', 'East', 'North', 'Center', 'South', 'Everywhere', 'Online']

const AGE_CATEGORY_OPTIONS = [
  'expecting',
  'newborn',
  'baby',
  'toddler',
  'all ages',
]

const baseInputStyle = "w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-lg py-2 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 transition-colors bg-white"
const inputStyle = `${baseInputStyle} px-3`
const selectStyle = `${baseInputStyle} pl-3 pr-8 cursor-pointer`
const descriptionStyle = "w-full text-sm leading-relaxed text-black border border-slate-200 p-3 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 resize-none overflow-hidden bg-violet-50/40 rounded-lg transition-colors"

interface LocationDrawerProps {
  location: Location
  onClose: () => void
  onSaved: (loc: Location) => void
  // No archived state for locations — rejecting one means deleting it outright.
  onDelete?: (id: string) => void
}

export function LocationDrawer({ location, onClose, onSaved, onDelete }: LocationDrawerProps) {
  const [formData, setFormData] = useState<Location>({ ...location })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [categoryInput, setCategoryInput] = useState('')
  const latestFormData = useRef(formData)
  latestFormData.current = formData
  const descriptionRef = useAutosizeTextArea(formData.description ?? '')

  const handleChange = (field: keyof Location, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaveState('saving')
    try {
      await updateLocation(formData.id, {
        name: formData.name,
        address: formData.address,
        area: formData.area,
        neighborhood: formData.neighborhood,
        url: formData.url,
        description: formData.description,
        categories: formData.categories,
        age_categories: formData.age_categories,
        postpartum_post: formData.postpartum_post,
      })
      setSaveState('saved')
      onSaved(formData)
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      console.error('updateLocation failed:', e)
      setSaveState('idle')
    }
  }

  const handleBlurSave = () => handleSave()

  const addCategory = (cat: string) => {
    const trimmed = cat.trim()
    if (!trimmed || formData.categories.includes(trimmed)) return
    const next = { ...formData, categories: [...formData.categories, trimmed] }
    setFormData(next)
    setCategoryInput('')
  }

  const removeCategory = (cat: string) => {
    handleChange('categories', formData.categories.filter(c => c !== cat))
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 border-b border-slate-100 p-4 flex items-center justify-between z-20 bg-violet-600">
          <div className="flex items-center gap-2">
            <Edit size={18} className="text-white ml-3" />
            <span className="text-lg tracking-wide text-white font-bold pl-2 py-1 rounded">
              Edit location
            </span>
          </div>
          <button onClick={onClose} className="p-2 text-white hover:text-violet-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-8 space-y-6 pb-32">

          {/* Core fields */}
          <section className="space-y-4">
            <Field label="Name">
              <input
                className="w-full text-2xl font-black tracking-tight border-none p-0 focus:ring-0 focus:outline-none text-slate-900"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                onBlur={handleBlurSave}
              />
            </Field>

            <Field label="Website">
              <div className="flex items-center gap-2">
                <input
                  value={formData.url ?? ''}
                  onChange={e => handleChange('url', e.target.value)}
                  onBlur={handleBlurSave}
                  placeholder="https://example.com"
                  className={inputStyle + " font-mono text-violet-600"}
                />
                {formData.url && (
                  <a
                    href={formData.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-xs font-black whitespace-nowrap"
                  >
                    <ExternalLink size={13} /> Visit
                  </a>
                )}
              </div>
            </Field>

            <Field label="Description">
              <textarea
                ref={descriptionRef}
                value={formData.description ?? ''}
                onChange={e => handleChange('description', e.target.value)}
                onBlur={handleBlurSave}
                className={descriptionStyle}
                placeholder="Brief description of this venue or organization..."
              />
            </Field>
          </section>

          {/* Location */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black">Location</h2>
            </div>

            <Field label="Address">
              <input
                value={formData.address}
                onChange={e => handleChange('address', e.target.value)}
                onBlur={handleBlurSave}
                className={inputStyle}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <Field label="Area">
                <select
                  value={formData.area ?? ''}
                  onChange={e => handleChange('area', e.target.value || null)}
                  onBlur={handleBlurSave}
                  className={selectStyle}
                >
                  <option value="">Select area</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Neighborhood">
                <input
                  value={formData.neighborhood ?? ''}
                  onChange={e => handleChange('neighborhood', e.target.value || null)}
                  onBlur={handleBlurSave}
                  className={inputStyle}
                />
              </Field>
            </div>

            {(formData.latitude || formData.longitude) && (
              <div className="grid grid-cols-2 gap-2 md:gap-4">
                <Field label="Latitude">
                  <div className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}>{formData.latitude}</div>
                </Field>
                <Field label="Longitude">
                  <div className={`${inputStyle} bg-slate-50 text-slate-400 text-xs`}>{formData.longitude}</div>
                </Field>
              </div>
            )}
          </section>

          {/* Categories */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black">Categories</h2>
            </div>

            <div className="flex gap-2">
              <input
                value={categoryInput}
                onChange={e => setCategoryInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addCategory(categoryInput) }
                }}
                placeholder="Add category…"
                className={inputStyle}
              />
              <button
                type="button"
                onClick={() => addCategory(categoryInput)}
                className="px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-black hover:bg-violet-700 transition-colors whitespace-nowrap"
              >
                Add
              </button>
            </div>

            {formData.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.categories.map(cat => (
                  <span key={cat} className="flex items-center gap-1 px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-bold">
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeCategory(cat)}
                      className="hover:text-violet-900 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Age Categories */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={18} className="text-slate-700" />
              <h2 className="text-slate-700 text-base md:text-xl font-black">Age Categories</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AGE_CATEGORY_OPTIONS.map(cat => {
                const active = (formData.age_categories ?? []).includes(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? formData.age_categories.filter(c => c !== cat)
                        : [...(formData.age_categories ?? []), cat]
                      handleChange('age_categories', next)
                    }}
                    onBlur={handleBlurSave}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors border ${
                      active
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Postpartum Post toggle */}
          <section className="space-y-4">
            <Toggle
              label="Postpartum Post"
              icon={<Mail size={14} className={formData.postpartum_post ? "text-violet-500" : "text-slate-400"} />}
              checked={formData.postpartum_post}
              onChange={v => {
                const next = { ...formData, postpartum_post: v }
                setFormData(next)
                updateLocation(formData.id, { postpartum_post: v }).catch(console.error)
              }}
            />
          </section>

          {/* Meta */}
          <section className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Record</p>
            <div className={`${inputStyle} bg-amber-50 text-amber-700 border-amber-200 text-xs`}>{formData.id}</div>
          </section>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-6 z-20 flex gap-3">
          {onDelete && (
            <button
              onClick={() => { onDelete(location.id); onClose() }}
              title="Delete permanently — locations have no archived state"
              className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="flex-1 bg-violet-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-violet-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            {saveState === 'saved'
              ? <><Check size={18} strokeWidth={3} /> Saved</>
              : saveState === 'saving'
              ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Saving…</>
              : <><Check size={18} strokeWidth={3} /> Save location</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}

function Field({ label, children }: { label: string, children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] text-violet-600 font-black uppercase tracking-widest">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ label, icon, checked, onChange }: { label: string, icon?: ReactNode, checked: boolean, onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 px-1 py-0.5"
    >
      <div className={`relative inline-flex h-6 w-16 items-center rounded-full transition-colors ${checked ? 'bg-violet-500' : 'bg-slate-200'}`}>
        <span className={`absolute text-[9px] font-black uppercase tracking-wider transition-all ${checked ? 'left-2 text-white' : 'right-2 text-slate-400'}`}>
          {checked ? 'YES' : 'NO'}
        </span>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-10' : 'translate-x-1'}`} />
      </div>
      <div className={`flex items-center gap-2 transition-colors ${checked ? 'text-violet-500' : 'text-slate-400'}`}>
        {icon}
        <span className={`text-xs md:text-sm font-bold whitespace-nowrap transition-colors ${checked ? 'text-violet-500' : 'text-slate-500'}`}>{label}</span>
      </div>
    </button>
  )
}
