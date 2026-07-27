// components/card/CaptureCardForm.tsx
import { useState, useRef, useEffect } from 'react'
import { Paperclip, X, Send, Sparkles, MapPin, AlertTriangle } from 'lucide-react'
import { CaptureCardProps } from '../../types/card'
import { Location } from '../../types/activity'

const AREAS = ['West', 'East', 'North', 'Center', 'South', 'Everywhere', 'Online']

const fieldStyle = (ring: string) =>
  `w-full text-sm font-bold text-slate-700 border border-slate-200 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 ${ring} transition-colors bg-white`

export function CaptureCardForm({ onAdd, onAddLocation, listId, locations = [] }: CaptureCardProps) {
  return (
    <div className="space-y-3">
      <EventForm onAdd={onAdd} listId={listId} />
      <ResourceForm onAdd={onAdd} listId={listId} />
      {onAddLocation && <LocationForm onAddLocation={onAddLocation} locations={locations} />}
    </div>
  )
}

function EventForm({ onAdd, listId }: Pick<CaptureCardProps, 'onAdd' | 'listId'>) {
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [useAi, setUseAi] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [description])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() && !file) return
    onAdd({ description, file, list_id: listId, use_ai: useAi, type: 'event' })
    setDescription('')
    setFile(null)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border-2 border-blue-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Event</p>
      <textarea
        ref={textareaRef}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Paste links, type titles, or add notes..."
        className="w-full text-sm text-slate-800 border-none p-2 focus:ring-0 resize-none min-h-[52px] max-h-[400px] placeholder:text-slate-400"
      />
      {file && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5 mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip size={12} className="text-blue-500 shrink-0" />
            <span className="text-[10px] font-bold text-blue-700 truncate uppercase tracking-tight">{file.name}</span>
          </div>
          <button type="button" onClick={() => setFile(null)} className="text-blue-400 hover:text-blue-600">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-slate-50 pt-2 gap-2">
        <div className="flex items-center gap-1.5">
          <input type="file" ref={fileInputRef} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">
            <Paperclip size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Attach</span>
          </button>
          <button type="button" onClick={() => setUseAi(v => !v)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${useAi ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            <Sparkles size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">AI</span>
          </button>
        </div>
        <button type="submit" disabled={!description.trim() && !file}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-sm active:scale-95 shrink-0">
          <Send size={15} strokeWidth={3} />
        </button>
      </div>
    </form>
  )
}

function ResourceForm({ onAdd, listId }: Pick<CaptureCardProps, 'onAdd' | 'listId'>) {
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [useAi, setUseAi] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [description])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() && !file) return
    onAdd({ description, file, list_id: listId, use_ai: useAi, type: 'resource' })
    setDescription('')
    setFile(null)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border-2 border-orange-200 rounded-xl p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 mb-2">Resource</p>
      <textarea
        ref={textareaRef}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Paste links, type titles, or add notes..."
        className="w-full text-sm text-slate-800 border-none p-2 focus:ring-0 resize-none min-h-[52px] max-h-[400px] placeholder:text-slate-400"
      />
      {file && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-2 py-1.5 mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip size={12} className="text-orange-500 shrink-0" />
            <span className="text-[10px] font-bold text-orange-700 truncate uppercase tracking-tight">{file.name}</span>
          </div>
          <button type="button" onClick={() => setFile(null)} className="text-orange-400 hover:text-orange-600">
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-slate-50 pt-2 gap-2">
        <div className="flex items-center gap-1.5">
          <input type="file" ref={fileInputRef} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors">
            <Paperclip size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Attach</span>
          </button>
          <button type="button" onClick={() => setUseAi(v => !v)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${useAi ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
            <Sparkles size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">AI</span>
          </button>
        </div>
        <button type="submit" disabled={!description.trim() && !file}
          className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-sm active:scale-95 shrink-0">
          <Send size={15} strokeWidth={3} />
        </button>
      </div>
    </form>
  )
}

export function LocationForm({ onAddLocation, locations }: Pick<CaptureCardProps, 'onAddLocation'> & { locations: Location[] }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [area, setArea] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [open, setOpen] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  const filtered = locations.filter(l => l.name.toLowerCase().includes(name.toLowerCase()))
  const exactMatch = locations.find(l => l.name.toLowerCase() === name.trim().toLowerCase())

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !address.trim()) return
    onAddLocation?.({ name: name.trim(), address: address.trim(), area: area || null, neighborhood: neighborhood.trim() || null })
    setName(''); setAddress(''); setArea(''); setNeighborhood('')
  }

  const f = fieldStyle('focus:ring-violet-400 focus:border-violet-400')

  return (
    <form onSubmit={handleSubmit} className="bg-white border-2 border-violet-200 rounded-xl p-3 shadow-sm space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Location</p>

      {/* Name with autocomplete */}
      <div ref={comboRef} className="relative">
        <input
          value={name}
          onChange={e => { setName(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Venue or organization name"
          className={f}
        />
        {open && name && filtered.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-44 overflow-y-auto">
            {filtered.map(loc => (
              <li key={loc.id}>
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    setName(loc.name)
                    setAddress(loc.address)
                    setArea(loc.area ?? '')
                    setNeighborhood(loc.neighborhood ?? '')
                    setOpen(false)
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 flex items-center gap-2"
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

      {exactMatch && (
        <div className="flex items-center gap-2 px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-700">
          <AlertTriangle size={12} className="shrink-0" />
          Already saved — submitting will update the existing record
        </div>
      )}

      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className={f} />
      <div className="grid grid-cols-2 gap-2">
        <select value={area} onChange={e => setArea(e.target.value)} className={`${f} cursor-pointer`}>
          <option value="">Area…</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Neighborhood" className={f} />
      </div>
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={!name.trim() || !address.trim()}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-40 transition-all shadow-sm active:scale-95">
          <MapPin size={13} strokeWidth={3} /> Capture
        </button>
      </div>
    </form>
  )
}
