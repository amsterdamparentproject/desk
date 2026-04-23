// components/InboxForm.tsx
import { useState, useRef, useEffect } from 'react'
import { Paperclip, Send, X } from 'lucide-react'

export function InboxForm({ onAdd }: { onAdd: (data: any) => void }) {
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize the description box as you type or paste
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [description])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() && !file) return

    onAdd({
      description,
      file,
      id: crypto.randomUUID(),
      list_id: 'incoming',
    })

    setDescription('')
    setFile(null)
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm mb-4"
    >
      {/* 1. Description Area (The Catch-All) */}
      <textarea
        ref={textareaRef}
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Paste links, type titles, or add notes..."
        className="w-full text-sm text-slate-800 border-none p-2 focus:ring-0 resize-none min-h-[60px] max-h-[300px] placeholder:text-slate-400"
      />

      {/* 2. File Attachment Display */}
      {file && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5 mb-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip size={12} className="text-blue-500 flex-shrink-0" />
            <span className="text-[10px] font-bold text-blue-700 truncate uppercase tracking-tight">
              {file.name}
            </span>
          </div>
          <button 
            type="button" 
            onClick={() => setFile(null)}
            className="text-blue-400 hover:text-blue-600 p-0.5"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. Action Row */}
      <div className="flex items-center justify-between border-t border-slate-50 pt-2">
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Paperclip size={14} />
            <span className="text-[10px] font-black uppercase">Attach</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={!description.trim() && !file}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-50 disabled:text-slate-300 transition-all shadow-sm"
        >
          <Send size={16} strokeWidth={3} />
        </button>
      </div>
    </form>
  )
}