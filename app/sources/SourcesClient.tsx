'use client'

import { useState, useTransition } from 'react'
import { Source, FetchType, createSource, updateSource, deleteSource } from '@/app/actions/sources'

interface UrlAnalysis {
  fetch_type: FetchType
  config: Record<string, unknown>
  label: string  // human-readable detection label
}

function analyzeUrl(url: string): UrlAnalysis | null {
  try { new URL(url) } catch { return null }

  // Eventbrite organizer: eventbrite.*/o/name-123456
  const ebMatch = url.match(/eventbrite\.[^/]+\/o\/[^/]+-(\d+)/)
  if (ebMatch) return {
    fetch_type: 'scrape',
    config: { platform: 'eventbrite', organizer_id: ebMatch[1] },
    label: 'Eventbrite organizer',
  }

  // Luma user profile: lu.ma/user/slug or luma.com/user/slug — no iCal feed, must scrape
  const lumaUserMatch = url.match(/(?:lu\.ma|luma\.com)\/user\/([a-z0-9_-]+)/i)
  if (lumaUserMatch) return {
    fetch_type: 'scrape',
    config: { platform: 'luma', user_slug: lumaUserMatch[1] },
    label: 'Luma user profile',
  }

  // Luma calendar: lu.ma/slug (short calendar URLs have a public iCal feed)
  const lumaCalMatch = url.match(/(?:lu\.ma|luma\.com)\/(?!e\/)([a-z0-9_-]+)/i)
  if (lumaCalMatch) return {
    fetch_type: 'ical',
    config: { platform: 'luma', calendar_slug: lumaCalMatch[1] },
    label: 'Luma calendar',
  }

  // Meetup group events: meetup.com/group-name/events
  const meetupMatch = url.match(/meetup\.com\/([^/]+)/)
  if (meetupMatch) return {
    fetch_type: 'api',
    config: { platform: 'meetup', group_slug: meetupMatch[1] },
    label: 'Meetup group',
  }

  // Facebook events page
  if (/facebook\.com/.test(url)) return {
    fetch_type: 'scrape',
    config: { platform: 'facebook' },
    label: 'Facebook page',
  }

  // iCal feed
  if (/\.ics(\?|$)/.test(url) || /[?&]format=ics/.test(url)) return {
    fetch_type: 'ical',
    config: {},
    label: 'iCal feed',
  }

  // RSS feed
  if (/\/(feed|rss)(\/|\.xml|\?|$)/.test(url) || /\.rss(\?|$)/.test(url)) return {
    fetch_type: 'rss',
    config: {},
    label: 'RSS feed',
  }

  return null
}

const FETCH_TYPE_LABELS: Record<FetchType, string> = {
  ical: 'iCal',
  api: 'API',
  scrape: 'Scrape',
  rss: 'RSS',
}

const FETCH_TYPE_COLORS: Record<FetchType, string> = {
  ical: 'bg-blue-100 text-blue-800',
  api: 'bg-purple-100 text-purple-800',
  scrape: 'bg-amber-100 text-amber-800',
  rss: 'bg-green-100 text-green-800',
}

const EMPTY_FORM = {
  name: '',
  url: '',
  fetch_type: 'ical' as FetchType,
  notes: '',
  config: '',
}

export function SourcesClient({ initialSources }: { initialSources: Source[] }) {
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Source | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [detection, setDetection] = useState<UrlAnalysis | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUrlChange(url: string) {
    const analysis = analyzeUrl(url)
    setDetection(analysis)
    setForm(f => ({
      ...f,
      url,
      ...(analysis && !editing ? {
        fetch_type: analysis.fetch_type,
        config: Object.keys(analysis.config).length
          ? JSON.stringify(analysis.config, null, 2)
          : '',
      } : {}),
    }))
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDetection(null)
    setConfigError(null)
    setDrawerOpen(true)
  }

  function openEdit(source: Source) {
    setEditing(source)
    setDetection(analyzeUrl(source.url))
    setForm({
      name: source.name,
      url: source.url,
      fetch_type: source.fetch_type,
      notes: source.notes ?? '',
      config: source.config ? JSON.stringify(source.config, null, 2) : '',
    })
    setConfigError(null)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setEditing(null)
    setDetection(null)
  }

  function parseConfig(raw: string): Record<string, unknown> | null {
    if (!raw.trim()) return null
    try {
      return JSON.parse(raw)
    } catch {
      throw new Error('Config must be valid JSON')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setConfigError(null)

    let config: Record<string, unknown> | null = null
    try {
      config = parseConfig(form.config)
    } catch (err) {
      setConfigError((err as Error).message)
      return
    }

    startTransition(async () => {
      if (editing) {
        const updated = await updateSource(editing.id, {
          name: form.name,
          url: form.url,
          fetch_type: form.fetch_type,
          notes: form.notes || null,
          config,
        })
        setSources(prev => prev.map(s => s.id === updated.id ? updated : s))
      } else {
        const created = await createSource({
          name: form.name,
          url: form.url,
          fetch_type: form.fetch_type,
          notes: form.notes || null,
          config,
        })
        setSources(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      closeDrawer()
    })
  }

  function handleToggle(source: Source) {
    startTransition(async () => {
      const updated = await updateSource(source.id, { active: !source.active })
      setSources(prev => prev.map(s => s.id === updated.id ? updated : s))
    })
  }

  function handleDelete(source: Source) {
    if (!confirm(`Delete "${source.name}"?`)) return
    startTransition(async () => {
      await deleteSource(source.id)
      setSources(prev => prev.filter(s => s.id !== source.id))
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sources</h1>
            <p className="text-sm text-slate-600 mt-1">Sites and calendars to scrape for events</p>
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            + Add Source
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {sources.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-lg font-medium">No sources yet</p>
            <p className="text-sm mt-1">Add a site or calendar to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 hidden md:table-cell">URL</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600 hidden lg:table-cell">Last Fetched</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Active</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {sources.map(source => (
                  <tr key={source.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {source.name}
                      {source.notes && (
                        <p className="text-xs text-slate-400 font-normal mt-0.5">{source.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${FETCH_TYPE_COLORS[source.fetch_type]}`}>
                        {FETCH_TYPE_LABELS[source.fetch_type]}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-xs block"
                      >
                        {source.url}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-slate-500 hidden lg:table-cell">
                      {source.last_fetched_at
                        ? new Date(source.last_fetched_at).toLocaleDateString()
                        : <span className="text-slate-300">Never</span>}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggle(source)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${source.active ? 'bg-green-500' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${source.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(source)}
                          className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(source)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative ml-auto w-full max-w-md bg-white shadow-xl h-full overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                {editing ? 'Edit Source' : 'Add Source'}
              </h2>
              <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5 px-6 py-6">
              <Field label="Name" required>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Amsterdam Mamas"
                  required
                  className="input"
                />
              </Field>

              <Field label="URL" required>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => handleUrlChange(e.target.value)}
                  placeholder="https://..."
                  required
                  className="input"
                />
                {detection && (
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mt-1">
                    ✓ Detected: {detection.label} — fetch type and config pre-filled
                  </p>
                )}
              </Field>

              <Field label="Fetch Type" required>
                <select
                  value={form.fetch_type}
                  onChange={e => setForm(f => ({ ...f, fetch_type: e.target.value as FetchType }))}
                  className="input"
                >
                  {(Object.keys(FETCH_TYPE_LABELS) as FetchType[]).map(ft => (
                    <option key={ft} value={ft}>{FETCH_TYPE_LABELS[ft]}</option>
                  ))}
                </select>
              </Field>

              <Field label="Config (JSON)" hint="Optional — source-specific options">
                <textarea
                  value={form.config}
                  onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
                  placeholder={'{\n  "selector": ".event-title"\n}'}
                  rows={4}
                  className="input font-mono text-xs"
                />
                {configError && <p className="text-xs text-red-500 mt-1">{configError}</p>}
              </Field>

              <Field label="Notes">
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes about this source"
                  className="input"
                />
              </Field>

              <div className="mt-auto flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Add Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #0f172a;
          background: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.15);
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-slate-400 font-normal ml-1.5 text-xs">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
