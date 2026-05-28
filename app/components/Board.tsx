'use client';

import { useState, useEffect, useRef } from 'react'
import { Column } from './Column'
import { CaptureDataProps, createNewActivity, DeskActivity, Location } from '../types/activity'
import { ALL_LISTS, NEWSLETTER_LISTS, TRIAGE_LISTS, ListId, Tab } from '../types/list'
import { ActivityDrawer } from './ActivityDrawer'
import { postDesk } from '../../lib/PostToWebhook'
import { archiveActivity, createActivity, deleteActivity, finishNewsletterIssue, moveActivity, pollForUpdates, saveActivity, uploadActivityFile } from '../actions/activities'
import { Calendar, Check, Newspaper, RotateCcw, Trash2 } from 'lucide-react'
import { Card } from './card/Card'
import { NewsletterDrawer } from './NewsletterDrawer'


function ArchivedCard({ activity, onDetails, onRestore, onDelete, isSelected, onToggleSelect }: {
  activity: DeskActivity
  onDetails: (a: DeskActivity) => void
  onRestore: (id: string) => void
  onDelete: (id: string, type: 'event' | 'resource') => void
  isSelected: boolean
  onToggleSelect: () => void
}) {
  const [confirm, setConfirm] = useState(false)

  const checkbox = (
    <button
      onClick={onToggleSelect}
      className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-blue-600'}`}
    >
      {isSelected ? <Check size={11} /> : <div className="w-3 h-3 rounded border-2 border-current" />}
    </button>
  )

  return (
    <Card activity={activity} onDetails={onDetails} detailsAction={checkbox}>
      <div className="flex h-10 px-2 py-1.5 gap-1.5">
        <button
          onClick={() => onRestore(activity.id)}
          className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white transition-colors uppercase"
        >
          <RotateCcw size={12} /> Restore
        </button>
        {confirm ? (
          <>
            <button
              onClick={() => onDelete(activity.id, activity.type)}
              className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors uppercase"
            >
              <Trash2 size={12} /> Confirm
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="px-3 flex rounded-lg items-center justify-center text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              ×
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="flex-1 flex rounded-lg items-center justify-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-600 hover:text-white transition-colors uppercase"
          >
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>
    </Card>
  )
}

interface BoardProps {
  initialActivities: DeskActivity[];
  initialLocations?: Location[];
  initialPublishDate: string;
}

export default function Board({ initialActivities, initialLocations = [], initialPublishDate } : BoardProps) {
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [activeTab, setActiveTab] = useState<Tab>('triage');
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [publishDate, setPublishDate] = useState<string>(initialPublishDate);

  const handlePublishDateChange = (date: string) => {
    setPublishDate(date);
  };

  const [activities, setActivities] = useState<DeskActivity[]>(initialActivities)
  const [selectedActivity, setSelectedActivity] = useState<DeskActivity | null>(null)
  const [newsletterOpen, setNewsletterOpen] = useState(false)
  const processingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const disarmProcessingTimeout = (id: string) => {
    const t = processingTimeouts.current.get(id)
    if (t !== undefined) { clearTimeout(t); processingTimeouts.current.delete(id) }
  }
  const [openCols, setOpenCols] = useState<Set<ListId>>(() => {
    const allIds = [...TRIAGE_LISTS, ...NEWSLETTER_LISTS].map(col => col.id)
    return new Set(allIds)
  })

  // Returns the newsletter_last value to write when a card moves between lists.
  // undefined = no change needed; null = clear it; string = set it.
  const newsletterLastDelta = (
    fromList: string,
    toList: string,
    currentNewsletterLast: string | null | undefined,
  ): string | null | undefined => {
    if (toList === 'next_newsletter') return publishDate
    if (fromList === 'next_newsletter' && currentNewsletterLast === publishDate) return null
    return undefined
  }

  const handleSaveDraft = async (updated: DeskActivity) => {
    const original = activities.find(e => e.id === updated.id)
    const delta = newsletterLastDelta(original?.list_id ?? updated.list_id, updated.list_id, updated.newsletter_last)
    const withStatus = {
      ...updated,
      status: 'edited' as const,
      ...(delta !== undefined ? { newsletter_last: delta } : {}),
    }
    setActivities(prev => prev.map(e => e.id === updated.id ? withStatus : e))
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

    const delta = !shouldArchive ? newsletterLastDelta(updated.list_id, targetList, updated.newsletter_last) : undefined
    const withListAndStatus = shouldArchive
      ? { ...updated, status: 'archived' as const }
      : { ...updated, list_id: targetList, status: 'edited' as const, ...(delta !== undefined ? { newsletter_last: delta } : {}) }
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
    const delta = newsletterLastDelta(activity.list_id, targetList, activity.newsletter_last)
    setActivities(prev => prev.map(e => e.id === id
      ? { ...e, list_id: targetList, status: newStatus, ...(delta !== undefined ? { newsletter_last: delta } : {}) }
      : e
    ))
    try {
      await moveActivity(id, activity.type, targetList, targetList === 'capture' ? 'processing' : undefined, delta)
    } catch (err) {
      console.error('Move failed:', err)
      setActivities(prev => prev.map(e => e.id === id
        ? { ...e, list_id: activity.list_id, status: activity.status, newsletter_last: activity.newsletter_last }
        : e
      ))
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

  const toggleArchiveSelect = (id: string) =>
    setSelectedArchiveIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleBulkDelete = async () => {
    const toDelete = activities.filter(a => selectedArchiveIds.has(a.id))
    setSelectedArchiveIds(new Set())
    setConfirmBulkDelete(false)
    setActivities(prev => prev.filter(a => !selectedArchiveIds.has(a.id)))
    try {
      await Promise.all(toDelete.map(a => deleteActivity(a.id, a.type)))
    } catch (err) {
      console.error('Bulk delete failed:', err)
      setActivities(prev => [...prev, ...toDelete])
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
      await saveActivity(activity.id, activity.type, { status: 'processing' })
      const result = await postDesk({ ...activity, id: activity.id, action: 'update', use_ai: true, file: null })
      if (!result.success) throw new Error(`Webhook failed with status ${result.status}`)
    } catch (err) {
      disarmProcessingTimeout(activity.id)
      console.error('Send to AI Error:', err)
      setActivities(prev => prev.map(e =>
        e.id === activity.id ? { ...e, status: 'new' as const, list_id: 'error' as ListId } : e
      ))
    }
  }

  const processingActivities = activities.filter(a => a.status === 'processing')
  useEffect(() => {
    if (processingActivities.length === 0) return
    const processingMeta = processingActivities.map(a => ({
      id: a.id,
      type: a.type,
      created_at: a.created_at,
    }))
    const intervalId = setInterval(async () => {
      const fetched = await pollForUpdates(processingMeta)
      setActivities(prev => {
        const fetchedMap = new Map(fetched.map(a => [a.id, a]))
        const updated = prev.map(a =>
          fetchedMap.has(a.id)
            ? { ...fetchedMap.get(a.id)!, file: a.file, preview_url: a.preview_url }
            : a
        )
        const existingIds = new Set(prev.map(a => a.id))
        const newItems = fetched.filter(a => !existingIds.has(a.id))
        return [...newItems, ...updated]
      })
      const now = Date.now()
      fetched.forEach(a => {
        if (a.status !== 'processing') {
          disarmProcessingTimeout(a.id)
        } else if (now - new Date(a.created_at).getTime() > 5 * 60 * 1000) {
          // Stuck for more than 10 minutes — move to error
          disarmProcessingTimeout(a.id)
          moveToError(a.id, a.type, a.title || '', true)
        }
      })
    }, 3000)
    return () => clearInterval(intervalId)
  }, [processingActivities.length])

  const currentColumns = activeTab === 'triage' ? TRIAGE_LISTS : activeTab === 'newsletter' ? NEWSLETTER_LISTS : []
  const archivedActivities = activities
    .filter(e => e.status === 'archived')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 z-10">
        <div className="flex px-4 gap-8 items-center justify-between">
          <div className="flex gap-8">
            {(['triage', 'newsletter', 'archived'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${tab === 'archived' ? 'hidden md:block' : ''} ${
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
            <div className="hidden md:flex items-center gap-2">
              <Calendar size={12} className="text-slate-400" />
              <label className="text-[9px] font-black uppercase tracking-widest text-green-600">Next newsletter</label>
              <input
                type="date"
                value={publishDate}
                onChange={(e) => handlePublishDateChange(e.target.value)}
                className="text-xs font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <button
              onClick={() => setNewsletterOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <Newspaper size={11} /> View
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'archived' ? (
        <div className="flex-1 overflow-y-auto">
          {selectedArchiveIds.size > 0 && (
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3">
              <span className="text-xs font-black text-slate-700">{selectedArchiveIds.size} selected</span>
              <button
                onClick={() => setSelectedArchiveIds(new Set(archivedActivities.map(a => a.id)))}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Select all
              </button>
              <button
                onClick={() => { setSelectedArchiveIds(new Set()); setConfirmBulkDelete(false) }}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear
              </button>
              <div className="ml-auto flex items-center gap-2">
                {confirmBulkDelete ? (
                  <>
                    <span className="text-xs font-black text-red-600">Delete {selectedArchiveIds.size} records?</span>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      <Trash2 size={11} /> Yes, delete all
                    </button>
                    <button
                      onClick={() => setConfirmBulkDelete(false)}
                      className="px-3 py-1.5 text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmBulkDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 hover:bg-red-600 hover:text-white rounded-lg transition-colors"
                  >
                    <Trash2 size={11} /> Delete {selectedArchiveIds.size}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="p-4">
            {archivedActivities.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400 italic">No archived records</div>
            ) : (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
                {archivedActivities.map(activity => (
                  <div key={activity.id} className="break-inside-avoid">
                    <ArchivedCard
                      activity={activity}
                      onDetails={setSelectedActivity}
                      onRestore={handleRestoreEvent}
                      onDelete={handleDeleteActivity}
                      isSelected={selectedArchiveIds.has(activity.id)}
                      onToggleSelect={() => toggleArchiveSelect(activity.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {newsletterOpen && (
        <NewsletterDrawer
          activities={activities}
          publishDate={publishDate}
          onPublishDateChange={handlePublishDateChange}
          onClose={() => setNewsletterOpen(false)}
          onFinishIssue={async () => {
            const next = activities.filter(a => a.list_id === 'next_newsletter' && a.status !== 'archived')
            if (!next.length) return
            const eventIds    = next.filter(a => a.type === 'event').map(a => a.id)
            const resourceIds = next.filter(a => a.type === 'resource').map(a => a.id)
            const d = new Date(publishDate); d.setDate(d.getDate() + 14)
            const newPublishDate = d.toISOString().split('T')[0]
            setActivities(prev => prev.map(a =>
              next.some(n => n.id === a.id)
                ? { ...a, newsletter_last: publishDate, status: 'archived' as const }
                : a
            ))
            handlePublishDateChange(newPublishDate)
            setNewsletterOpen(false)
            await finishNewsletterIssue(eventIds, resourceIds, publishDate).catch(err =>
              console.error('Failed to finish newsletter issue:', err)
            )
          }}
        />
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
          readOnly={selectedActivity.status === 'archived'}
          onRestore={() => handleRestoreEvent(selectedActivity.id)}
          locations={locations}
          onLocationSaved={(loc) =>
            setLocations(prev => {
              const idx = prev.findIndex(l => l.id === loc.id)
              return idx >= 0
                ? prev.map(l => l.id === loc.id ? loc : l)
                : [...prev, loc].sort((a, b) => a.name.localeCompare(b.name))
            })
          }
        />
      )}
    </main>
  )
}
