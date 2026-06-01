'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Sparkles, ImagePlus, X } from 'lucide-react'
import { captureFromShare, uploadActivityFile, saveActivity } from '@/app/actions/activities'

interface ShareFormProps {
  initialDescription: string
  url: string
  title: string
  initialFileUrl: string | null
  initialFileId: string | null
}

export function ShareForm({ initialDescription, url, title, initialFileUrl, initialFileId }: ShareFormProps) {
  const router = useRouter()
  const [description, setDescription] = useState(initialDescription)
  const [type, setType] = useState<'event' | 'resource'>('event')
  const [useAi, setUseAi] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // File already uploaded to Supabase by the POST share handler
  const [uploadedId, setUploadedId] = useState<string | null>(initialFileId)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(initialFileUrl)

  // File picked manually in the browser (uploaded on submit)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // The URL to show in the preview — manual pick takes precedence
  const displayImageUrl = pendingPreviewUrl ?? uploadedUrl

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    // Replace any pre-uploaded file
    setUploadedId(null)
    setUploadedUrl(null)
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(selected)
    setPendingPreviewUrl(selected ? URL.createObjectURL(selected) : null)
  }

  const removeImage = () => {
    setUploadedId(null)
    setUploadedUrl(null)
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
    setPendingFile(null)
    setPendingPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canSubmit = (description.trim().length > 0 || displayImageUrl !== null) && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      // Pass the pre-generated ID when the file is already in Supabase,
      // so captureFromShare uses the same ID and can include the file_url in the insert.
      const id = await captureFromShare({
        title,
        description,
        url,
        type,
        use_ai: useAi,
        ...(uploadedId && uploadedUrl ? { id: uploadedId, file_url: uploadedUrl } : {}),
      })
      if (pendingFile) {
        const fileUrl = await uploadActivityFile(id, pendingFile)
        await saveActivity(id, type, { file_url: fileUrl })
      }
      router.push('/')
    } catch (err) {
      console.error('Share capture failed:', err)
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
    >
      <textarea
        autoFocus
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Paste links, type titles, or add notes..."
        rows={4}
        className="w-full text-sm text-slate-800 border-none p-2 focus:ring-0 resize-none placeholder:text-slate-400"
      />

      {displayImageUrl && (
        <div className="relative mx-2 mb-2">
          <img
            src={displayImageUrl}
            alt="Selected image"
            className="w-full max-h-48 object-cover rounded-lg"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setUseAi(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              useAi ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <Sparkles size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Use AI</span>
          </button>

          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button
              type="button"
              onClick={() => setType('event')}
              className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                type === 'event' ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              Event
            </button>
            <button
              type="button"
              onClick={() => setType('resource')}
              className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                type === 'resource' ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-400 hover:bg-slate-50'
              }`}
            >
              Resource
            </button>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors ${
              displayImageUrl ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            <ImagePlus size={14} />
          </button>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-md active:scale-95"
        >
          {submitting ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Send size={16} strokeWidth={3} />
          )}
        </button>
      </div>
    </form>
  )
}
