'use client';

import { useState, useEffect, useRef } from 'react'
import { Column } from './Column'
import { CaptureDataProps, createNewActivity, DeskActivity } from '../types/activity'
import { ALL_LISTS, CAPTURE_LISTS, NEWSLETTER_LISTS, TRIAGE_LISTS, ListId, Tab } from '../types/list'
import { ActivityDrawer } from './ActivityDrawer'
import { postDesk } from '../../lib/PostToWebhook'
import { archiveActivity, createActivity, deleteActivity, moveActivity, saveActivity, uploadActivityFile } from '../actions/activities'
import { Calendar, RotateCcw } from 'lucide-react'
import { Card } from './card/Card'

const LS_KEY = 'app_desk_newsletter_publish_date'
const DEFAULT_PUBLISH_DATE = '2026-05-18'

function ArchivedCard({ activity, onDetails, onRestore }: {
  activity: DeskActivity
  onDetails: (a: DeskActivity) => void
  onRestore: (id: string) => void
}) {
  return (
    <Card activity={activity} onDetails={onDetails}>
      <div className="flex h-10 px-2 py-1.5">
        <button
          onClick={() => onRestore(activity.id)}
          className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-colors uppercase"
        >
          <RotateCcw size={12} /> Restore
        </button>
      </div>
    </Card>
  )
}

interface BoardProps {
  initialActivities: DeskActivity[];
}

export default function Board({ initialActivities } : BoardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('triage');
  const [publishDate, setPublishDate] = useState<string>(DEFAULT_PUBLISH_DATE);

  useEffect(() => {
    if (window.innerWidth < 768) setActiveTab('capture');
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setPublishDate(saved);
  }, []);

  const handlePublishDateChange = (date: string) => {
    setPublishDate(date);
    localStorage.setItem(LS_KEY, date);
  };

  const [activities, setActivities] = useState<DeskActivity[]>(initialActivities)
  const [selectedActivity, setSelectedActivity] = useState<DeskActivity | null>(null)
  const processingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const disarmProcessingTimeout = (id: string) => {
    const t = processingTimeouts.current.get(id)
    if (t !== undefined) { clearTimeout(t); processingTimeouts.current.delete(id) }
  }
  const [openCols, setOpenCols] = useState<Set<ListId>>(() => {
    const allIds = [...CAPTURE_LISTS, ...TRIAGE_LISTS, ...NEWSLETTER_LISTS].map(col => col.id)
    return new Set(allIds)
  })

  const handleSaveDraft = async (updated: DeskActivity) => {
    const withStatus = { ...updated, status: 'edited' as const }
    setActivities(prev => prev.map(e => e.id === updated.id ? withStatus : e))
    setSelectedActivity(null)
    try {
      await saveActivity(updated.id, updated.type, withStatus)
    } catch (err) {
      console.error('Save draft failed:', err)
    }
  }

  const handleFinishEditing = async (updated: DeskActivity) => {
    const list = ALL_LISTS.find(l => l.id === updated.list_id)
    const targetList: ListId = list?.finishTarget?.(updated.type) ?? (updated.type === 'event' ? 'upcoming_events' : 'new_resources')

    const today = new Date().toISOString().split('T')[0]
    const isTriageApproval = updated.list_id === 'review' || updated.list_id === 'error'
    const isPastEvent = updated.type === 'event' && !updated.repeat_frequency && updated.start_date && updated.start_date < today
    const shouldArchive = isTriageApproval && isPastEvent

    const withListAndStatus = shouldArchive
      ? { ...updated, status: 'archived' as const }
      : { ...updated, list_id: targetList, status: 'edited' as const }
    setActivities(prev => prev.map(e => e.id === updated.id ? withListAndStatus : e))
    setSelectedActivity(null)
    try {
      if (shouldArchive) {
        await archiveActivity(updated.id, updated.type)
      } else {
        await saveActivity(updated.id, updated.type, withListAndStatus)
      }
    } catch (err) {
      console.error('Finish editing failed:', err)
    }
  }

  const handleMoveEvent = async (id: string, targetList: ListId) => {
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    const newStatus = targetList === 'capture' ? 'processing' as const : activity.status
    setActivities(prev => prev.map(e => e.id === id ? { ...e, list_id: targetList, status: newStatus } : e))
    try {
      await moveActivity(id, activity.type, targetList, targetList === 'capture' ? 'processing' : undefined)
    } catch (err) {
      console.error('Move failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? { ...e, list_id: activity.list_id, status: activity.status } : e))
    }
  }

  const handleArchiveEvent = async (id: string) => {
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    setActivities(prev => prev.map(e => e.id === id ? { ...e, status: 'archived' as const } : e))
    try {
      await archiveActivity(id, activity.type)
    } catch (err) {
      console.error('Archive failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? { ...e, status: activity.status } : e))
    }
  }

  const handleSnoozeEvent = async (id: string) => {
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    const d = new Date(publishDate)
    d.setDate(d.getDate() + 1)
    const snoozeUntil = d.toISOString().split('T')[0]
    const updated = { ...activity, status: 'snoozed' as const, snooze_until: snoozeUntil }
    setActivities(prev => prev.map(e => e.id === id ? updated : e))
    try {
      await saveActivity(id, activity.type, updated)
    } catch (err) {
      console.error('Snooze failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? activity : e))
    }
  }

  const handleDeleteActivity = async (id: string, type: 'event' | 'resource') => {
    setActivities(prev => prev.filter(e => e.id !== id))
    try {
      await deleteActivity(id, type)
    } catch (err) {
      console.error('Delete failed:', err)
      const activity = activities.find(e => e.id === id)
      if (activity) setActivities(prev => [...prev, activity])
    }
  }

  const handleRestoreEvent = async (id: string) => {
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    setActivities(prev => prev.map(e => e.id === id ? { ...e, status: 'edited' as const } : e))
    try {
      await saveActivity(id, activity.type, { ...activity, status: 'edited' })
    } catch (err) {
      console.error('Restore failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? { ...e, status: 'archived' as const } : e))
    }
  }

  const moveToError = async (id: string, type: 'event' | 'resource', description: string, seedCreated: boolean) => {
    setActivities(prev => prev.map(e =>
      e.id === id ? { ...e, list_id: 'error' as ListId, status: 'new' as const, title: description } : e
    ))
    if (seedCreated) {
      await saveActivity(id, type, { list_id: 'error', status: 'new', title: description } as Partial<DeskActivity>).catch(() => {})
    } else {
      await createActivity(id, type, { list_id: 'error', status: 'new', description }).catch(() => {})
    }
  }

  const handleAddEvent = async (captureData: CaptureDataProps) => {
    const description = captureData.description || ''
    const type = captureData.type ?? 'event'
    const preview_url = captureData.file ? URL.createObjectURL(captureData.file) : null

    // Generate ID upfront so the storage path matches the DB record
    const id = crypto.randomUUID()

    if (captureData.use_ai) {
      const optimistic = createNewActivity(description, {
        id, type,
        list_id: captureData.list_id || 'capture',
        status: 'processing',
        file: captureData.file,
        preview_url,
      })
      setActivities(prev => [optimistic, ...prev])
      processingTimeouts.current.set(id, setTimeout(async () => {
        processingTimeouts.current.delete(id)
        await moveToError(id, type, description, true)
      }, 2 * 60 * 1000))

      // Upload file to storage before creating the seed record
      let file_url: string | null = null
      if (captureData.file) {
        try {
          file_url = await uploadActivityFile(id, captureData.file)
          if (preview_url) URL.revokeObjectURL(preview_url)
          setActivities(prev => prev.map(e => e.id === id ? { ...e, file_url, preview_url: null } : e))
        } catch (err) {
          console.error('File upload failed:', err)
        }
      }

      let seedCreated = false
      try {
        await createActivity(id, type, {
          description,
          list_id: captureData.list_id || 'capture',
          status: 'processing',
          file_url,
        })
        seedCreated = true

        const postDeskData = { ...captureData, file_url }

        const result = await postDesk({ ...postDeskData, id, action: 'add' })
        if (!result.success) throw new Error(`Webhook failed with status ${result.status}`)

        disarmProcessingTimeout(id)
        const rawData = result.data
        const items: DeskActivity[] = Array.isArray(rawData) ? rawData : [rawData]

        const first = { ...items[0], id, list_id: 'review' as ListId, file_url: items[0].file_url ?? file_url }
        setActivities(prev => prev.map(e => e.id === id ? first : e))

        for (const item of items.slice(1)) {
          const newId = crypto.randomUUID()
          const newActivity = { ...item, id: newId, list_id: 'review' as ListId, status: 'processed' as const, file_url: item.file_url ?? file_url }
          setActivities(prev => [newActivity, ...prev])
          try {
            await createActivity(newId, newActivity.type ?? type, {
              description: newActivity.description,
              list_id: 'review',
              status: 'processed',
              file_url: newActivity.file_url,
            })
            await saveActivity(newId, newActivity.type ?? type, newActivity)
          } catch (err) {
            console.error('Failed to persist additional activity:', newId, err)
          }
        }
      } catch (err) {
        disarmProcessingTimeout(id)
        console.error('Capture Error:', err)
        await moveToError(id, type, description, seedCreated)
      }
    } else {
      const reviewed = createNewActivity(description, {
        id, type,
        title: description,
        list_id: 'review',
        status: 'new',
        file: captureData.file,
        preview_url,
      })
      setActivities(prev => [reviewed, ...prev])

      // Upload file to storage before creating the seed record
      let file_url: string | null = null
      if (captureData.file) {
        try {
          file_url = await uploadActivityFile(id, captureData.file)
          if (preview_url) URL.revokeObjectURL(preview_url)
          setActivities(prev => prev.map(e => e.id === id ? { ...e, file_url, preview_url: null } : e))
        } catch (err) {
          console.error('File upload failed:', err)
        }
      }

      try {
        await createActivity(id, type, { description, list_id: 'review', status: 'new', file_url })
      } catch (err) {
        console.error('Capture Error:', err)
        await moveToError(id, type, description, false)
      }
    }
  }

  const handleSendToAI = async (activity: DeskActivity) => {
    setActivities(prev => prev.map(e => e.id === activity.id ? { ...e, status: 'processing' as const } : e))
    processingTimeouts.current.set(activity.id, setTimeout(() => {
      processingTimeouts.current.delete(activity.id)
      setActivities(prev => prev.map(e =>
        e.id === activity.id ? { ...e, status: 'new' as const, list_id: 'error' as ListId } : e
      ))
    }, 2 * 60 * 1000))
    try {
      const result = await postDesk({ ...activity, id: activity.id, action: 'update', use_ai: true, file: null })
      if (!result.success) throw new Error(`Webhook failed with status ${result.status}`)
      disarmProcessingTimeout(activity.id)
      const rawData = result.data
      const items: DeskActivity[] = Array.isArray(rawData) ? rawData : [rawData]
      const first = { ...items[0], id: activity.id, list_id: 'review' as ListId }
      setActivities(prev => prev.map(e => e.id === activity.id ? first : e))
      await saveActivity(activity.id, activity.type, first)
      for (const item of items.slice(1)) {
        const newId = crypto.randomUUID()
        const newActivity = { ...item, id: newId, list_id: 'review' as ListId, status: 'processed' as const }
        setActivities(prev => [newActivity, ...prev])
        try {
          await createActivity(newId, activity.type, { description: newActivity.description, list_id: 'review', status: 'processed' })
          await saveActivity(newId, activity.type, newActivity)
        } catch (err) {
          console.error('Failed to persist additional activity:', newId, err)
        }
      }
    } catch (err) {
      disarmProcessingTimeout(activity.id)
      console.error('Send to AI Error:', err)
      setActivities(prev => prev.map(e =>
        e.id === activity.id ? { ...e, status: 'new' as const, list_id: 'error' as ListId } : e
      ))
    }
  }

  const currentColumns = activeTab === 'capture' ? CAPTURE_LISTS : activeTab === 'triage' ? TRIAGE_LISTS : NEWSLETTER_LISTS
  const archivedActivities = activities
    .filter(e => e.status === 'archived')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 z-10">
        <div className="flex px-4 gap-8 items-center justify-between">
          <div className="flex gap-8">
            {(['capture', 'triage', 'newsletter', 'archived'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-black uppercase tracking-widest transition-all ${
                  activeTab === tab
                    ? tab === 'archived' ? 'text-red-500' : 'text-blue-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'archived' ? `archived (${archivedActivities.length})` : tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={12} className="text-slate-400" />
            <label className="text-[9px] font-black uppercase tracking-widest text-green-600">Next newsletter</label>
            <input
              type="date"
              value={publishDate}
              onChange={(e) => handlePublishDateChange(e.target.value)}
              className="text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      </header>

      {activeTab === 'archived' ? (
        <div className="flex-1 overflow-y-auto p-4">
          {archivedActivities.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400 italic">No archived records</div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
              {archivedActivities.map(activity => (
                <div key={activity.id} className="break-inside-avoid">
                  <ArchivedCard activity={activity} onDetails={setSelectedActivity} onRestore={handleRestoreEvent} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
        {currentColumns.map((col) => (
          <div
            key={col.id}
            className="w-full md:flex-1 md:basis-0 min-w-0"
          >
            <Column
              list={col}
              isOpen={typeof window !== 'undefined' && window.innerWidth >= 768 ? true : openCols.has(col.id)}
              onToggle={() => {
                setOpenCols(prev => {
                  const newSet = new Set(prev)
                  if (newSet.has(col.id)) newSet.delete(col.id)
                  else newSet.add(col.id)
                  return newSet
                })
              }}
              activities={activities
                .filter(e => e.list_id === col.id && e.status !== 'archived')
                .sort((a, b) => {
                  if (col.id === 'upcoming_events') {
                    const today = new Date().toISOString().split('T')[0]
                    const aInWindow = !!(a.repeat_next_date && a.repeat_next_date >= today && a.repeat_next_date <= publishDate)
                    const bInWindow = !!(b.repeat_next_date && b.repeat_next_date >= today && b.repeat_next_date <= publishDate)
                    if (aInWindow !== bInWindow) return aInWindow ? -1 : 1
                    if (aInWindow && bInWindow) return a.repeat_next_date!.localeCompare(b.repeat_next_date!)
                  }
                  if (!a.start_date && !b.start_date) return 0
                  if (!a.start_date) return 1
                  if (!b.start_date) return -1
                  return a.start_date.localeCompare(b.start_date)
                })
              }
              onDetails={setSelectedActivity}
              onMove={handleMoveEvent}
              onAddEvent={handleAddEvent}
              onArchive={handleArchiveEvent}
              onSnooze={handleSnoozeEvent}
              publishDate={publishDate}
            />
          </div>
        ))}
      </div>
      )}

      {selectedActivity && (
        <ActivityDrawer
          activity={activities.find(e => e.id === selectedActivity.id) ?? selectedActivity}
          onSaveDraft={handleSaveDraft}
          onFinishEditing={handleFinishEditing}
          onClose={() => setSelectedActivity(null)}
          publishDate={publishDate}
          onSendToAI={handleSendToAI}
          onDelete={handleDeleteActivity}
        />
      )}
    </main>
  )
}
