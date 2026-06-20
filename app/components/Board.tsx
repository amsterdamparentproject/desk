'use client';

import { useState, useEffect, useRef } from 'react'
import { Column } from './Column'
import { CaptureDataProps, createNewActivity, DeskActivity, Location } from '../types/activity'
import { ALL_LISTS, NEWSLETTER_LISTS, TRIAGE_LISTS, ListId, Tab } from '../types/list'
import { ActivityDrawer } from './ActivityDrawer'
import { LocationDrawer } from './LocationDrawer'
import { archiveActivity, createActivity, createLocation, deleteActivity, finishNewsletterIssue, moveActivity, pollForUpdates, saveActivity, updateLocation, uploadActivityFile } from '../actions/activities'
import { Check, Newspaper, RotateCcw, Trash2, MapPin, ChevronDown, ChevronRight } from 'lucide-react'
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
      <div className="mt-auto flex h-10 px-2 py-1.5 gap-1.5">
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

const PUBLISH_DATE_KEY = 'desk_publish_date'

interface BoardProps {
  initialActivities: DeskActivity[];
  initialLocations?: Location[];
}

export default function Board({ initialActivities, initialLocations = [] } : BoardProps) {
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [activeTab, setActiveTab] = useState<Tab>('triage');
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [publishDate, setPublishDate] = useState<string>('')

  useEffect(() => {
    const stored = localStorage.getItem(PUBLISH_DATE_KEY)
    if (stored) setPublishDate(stored)
  }, [])

  const handlePublishDateChange = (date: string) => {
    setPublishDate(date)
    localStorage.setItem(PUBLISH_DATE_KEY, date)
  };

  // Auto-move past next_newsletter events to review
  useEffect(() => {
    if (!publishDate) return
    const toMove = activities.filter(a =>
      a.type === 'event' &&
      a.list_id === 'next_newsletter' &&
      a.status !== 'archived' && a.status !== 'published' &&
      (a.end_date ? a.end_date < publishDate : (!!a.start_date && !a.repeat_rrule && a.start_date < publishDate))
    )
    if (toMove.length === 0) return
    setActivities(prev => prev.map(a => toMove.find(m => m.id === a.id) ? { ...a, list_id: 'review' } : a))
    toMove.forEach(a => moveActivity(a.id, a.type, 'review').catch(console.error))
  }, [publishDate])

  const [activities, setActivities] = useState<DeskActivity[]>(initialActivities)
  const [selectedActivity, setSelectedActivity] = useState<DeskActivity | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
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
  const [collapsedPostSections, setCollapsedPostSections] = useState<Set<string>>(new Set())
  const togglePostSection = (key: string) =>
    setCollapsedPostSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  const [postColFilter, setPostColFilter] = useState<Record<'single' | 'recurring' | 'locations', 'all' | 'post'>>({
    single: 'all', recurring: 'all', locations: 'all',
  })
  const togglePostColFilter = (col: 'single' | 'recurring' | 'locations') =>
    setPostColFilter(prev => ({ ...prev, [col]: prev[col] === 'all' ? 'post' : 'all' }))

  // Returns the newsletter_last value to write when a card moves between lists.
  // undefined = no change needed; null = clear it; string = set it.
  const newsletterLastDelta = (
    fromList: string,
    toList: string,
    currentNewsletterLast: string | null | undefined,
  ): string | null | undefined => {
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

  const handleToggleLocationPost = async (id: string) => {
    const loc = locations.find(l => l.id === id)
    if (!loc) return
    const next = !loc.postpartum_post
    setLocations(prev => prev.map(l => l.id === id ? { ...l, postpartum_post: next } : l))
    try {
      await updateLocation(id, { postpartum_post: next })
    } catch (err) {
      console.error('Toggle location postpartum_post failed:', err)
      setLocations(prev => prev.map(l => l.id === id ? { ...l, postpartum_post: !next } : l))
    }
  }

  const handleAddLocation = async (data: { name: string; address: string; area?: string | null; neighborhood?: string | null }) => {
    try {
      const loc = await createLocation(data)
      setLocations(prev => [...prev, loc])
    } catch (err) {
      console.error('createLocation failed:', err)
    }
  }

  const handleMoveLocation = async (id: string, targetList: ListId) => {
    setLocations(prev => prev.map(l => l.id === id ? { ...l, list_id: targetList } : l))
    try {
      await updateLocation(id, { list_id: targetList })
    } catch (err) {
      console.error('moveLocation failed:', err)
      setLocations(prev => prev.map(l => l.id === id ? { ...l, list_id: locations.find(x => x.id === id)?.list_id ?? 'ideas' } : l))
    }
  }

  const handleTogglePostpartumPost = async (id: string, type: 'event' | 'resource') => {
    const activity = activities.find(a => a.id === id)
    if (!activity) return
    const next = !activity.postpartum_post
    setActivities(prev => prev.map(a => a.id === id ? { ...a, postpartum_post: next } : a))
    try {
      await saveActivity(id, type, { postpartum_post: next })
    } catch (err) {
      console.error('Toggle postpartum_post failed:', err)
      setActivities(prev => prev.map(a => a.id === id ? { ...a, postpartum_post: !next } : a))
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

        const res = await fetch('/api/desk/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...postDeskData, id, action: 'add' }) })
        if (!res.ok) throw new Error(`Webhook failed with status ${res.status}`)
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
      const res = await fetch('/api/desk/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...activity, id: activity.id, action: 'update', use_ai: true, file: null }) })
      if (!res.ok) throw new Error(`Webhook failed with status ${res.status}`)
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
  const byUpdatedDesc = (a: DeskActivity, b: DeskActivity) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()

  const publishedRecurring = activities
    .filter(e => e.status === 'published' && e.type === 'event' && !!e.repeat_rrule)
    .sort(byUpdatedDesc)
  const publishedPast = activities
    .filter(e => e.status === 'published' && e.type === 'event' && !e.repeat_rrule)
    .sort(byUpdatedDesc)
  const publishedResources = activities
    .filter(e => e.status === 'published' && e.type === 'resource')
    .sort(byUpdatedDesc)
  const publishedActivities = [...publishedRecurring, ...publishedPast, ...publishedResources]
  const archivedActivities = activities
    .filter(e => e.status === 'archived')
    .sort(byUpdatedDesc)
  const activeTabItems = activeTab === 'published' ? publishedActivities : activeTab === 'archived' ? archivedActivities : []

  // Post tab: activities relevant to this calendar month
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0)
  const postWindowEnd = `${nextMonthEnd.getFullYear()}-${String(nextMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(nextMonthEnd.getDate()).padStart(2, '0')}`
  const liveEvents = activities.filter(a => a.type === 'event' && a.status !== 'archived')
  const postSingleEvents = liveEvents.filter(a => !a.repeat_rrule && !!a.start_date && a.start_date >= today && a.start_date <= postWindowEnd)
  const postRecurringEvents = liveEvents.filter(a => !!a.repeat_rrule && !!a.repeat_next_date && a.repeat_next_date.slice(0, 10) >= today && a.repeat_next_date.slice(0, 10) <= postWindowEnd)
  const nextMatchDate = new Date(now.getFullYear(), now.getMonth() + 1, 7)
  const nextMatchStr = `${nextMatchDate.getFullYear()}-${String(nextMatchDate.getMonth() + 1).padStart(2, '0')}-07`
  const postBeforeMatch = (dateKey: (a: DeskActivity) => string | null | undefined) =>
    (a: DeskActivity) => { const d = dateKey(a)?.slice(0, 10); return !!d && d < nextMatchStr }
  const postAfterMatch = (dateKey: (a: DeskActivity) => string | null | undefined) =>
    (a: DeskActivity) => { const d = dateKey(a)?.slice(0, 10); return !!d && d >= nextMatchStr }

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 z-10">
        <div className="flex px-4 gap-8 items-center justify-between">
          <div className="flex gap-8">
            {(['triage', 'newsletter', 'post', 'published', 'archived'] as Tab[]).map((tab) => {
              const isDesktopOnly = tab === 'published' || tab === 'archived'
              const activeColor =
                tab === 'archived'  ? 'text-red-500' :
                tab === 'published' ? 'text-green-600' :
                tab === 'post'      ? 'text-violet-600' :
                tab === 'triage'    ? 'text-orange-500' :
                'text-blue-600'
              const label =
                tab === 'published' ? `published` :
                tab === 'archived'  ? `archived` :
                tab === 'post'      ? `post` :
                tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 text-xs sm:text-sm font-black uppercase tracking-widest transition-all ${isDesktopOnly ? 'hidden md:block' : ''} ${activeTab === tab ? activeColor : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewsletterOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              <Newspaper size={11} /> Next issue
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'post' ? (
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
          {/* Single Events */}
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-violet-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">Single Events</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-700 text-white">{postSingleEvents.length}</span>
              </div>
              <button onClick={() => togglePostColFilter('single')} className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-violet-200">Post</span>
                <div className={`w-7 h-4 rounded-full transition-colors relative ${postColFilter.single === 'post' ? 'bg-white' : 'bg-violet-500'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow transition-transform ${postColFilter.single === 'post' ? 'bg-violet-600 translate-x-3.5' : 'bg-white translate-x-0.5'}`} />
                </div>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {postSingleEvents.length === 0 ? (

                <div className="py-10 text-center text-xs text-slate-400 italic">None in range</div>
              ) : (
                <>
                  {[
                    { label: 'This match', filter: postBeforeMatch(a => a.start_date) },
                    { label: 'Next match', filter: postAfterMatch(a => a.start_date) },
                  ].map(({ label, filter }) => {
                    const key = `single-${label}`
                    const items = postSingleEvents.filter(filter).filter(a => postColFilter.single === 'all' || a.postpartum_post).sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
                    if (items.length === 0) return null
                    const collapsed = collapsedPostSections.has(key)
                    return (
                      <div key={label}>
                        <button
                          onClick={() => togglePostSection(key)}
                          className="w-full flex items-center gap-1.5 px-1 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                          {label}
                          <span className="ml-auto bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>
                        </button>
                        {!collapsed && (
                          <div className="space-y-1.5">
                            {items.map(a => (
                              <div
                                key={a.id}
                                className={`bg-slate-50 border-2 rounded-lg px-3 py-2 transition-colors ${a.postpartum_post ? 'border-violet-300 bg-violet-50' : a.type === 'resource' ? 'border-orange-200' : 'border-blue-200'}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button onClick={() => setSelectedActivity(a)} className="flex-1 text-left">
                                    <span className="text-xs font-bold text-slate-800 leading-snug">{a.title}</span>
                                    {a.organization && <p className="text-[10px] text-slate-400 mt-0.5">{a.organization}</p>}
                                  </button>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                                      {a.start_date ? new Date(a.start_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                                    </span>
                                    <button
                                      onClick={() => handleTogglePostpartumPost(a.id, a.type)}
                                      className={`text-[10px] font-black px-1.5 py-0.5 rounded transition-colors ${a.postpartum_post ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-400 hover:bg-violet-100 hover:text-violet-600'}`}
                                    >
                                      Post
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* Recurring Events */}
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-violet-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">Recurring Events</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-700 text-white">{postRecurringEvents.length}</span>
              </div>
              <button onClick={() => togglePostColFilter('recurring')} className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-violet-200">Post</span>
                <div className={`w-7 h-4 rounded-full transition-colors relative ${postColFilter.recurring === 'post' ? 'bg-white' : 'bg-violet-500'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow transition-transform ${postColFilter.recurring === 'post' ? 'bg-violet-600 translate-x-3.5' : 'bg-white translate-x-0.5'}`} />
                </div>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {postRecurringEvents.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 italic">None in range</div>
              ) : (
                <>
                  {[
                    { label: 'This match', filter: postBeforeMatch(a => a.repeat_next_date) },
                    { label: 'Next match', filter: postAfterMatch(a => a.repeat_next_date) },
                  ].map(({ label, filter }) => {
                    const key = `recurring-${label}`
                    const items = postRecurringEvents.filter(filter).filter(a => postColFilter.recurring === 'all' || a.postpartum_post).sort((a, b) => (a.repeat_next_date ?? '').localeCompare(b.repeat_next_date ?? ''))
                    if (items.length === 0) return null
                    const collapsed = collapsedPostSections.has(key)
                    return (
                      <div key={label}>
                        <button
                          onClick={() => togglePostSection(key)}
                          className="w-full flex items-center gap-1.5 px-1 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                          {label}
                          <span className="ml-auto bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>
                        </button>
                        {!collapsed && (
                          <div className="space-y-1.5">
                            {items.map(a => (
                              <div
                                key={a.id}
                                className={`border-2 rounded-lg px-3 py-2 transition-colors ${a.postpartum_post ? 'border-violet-300 bg-violet-50' : a.type === 'resource' ? 'border-orange-200 bg-slate-50' : 'border-blue-200 bg-slate-50'}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button onClick={() => setSelectedActivity(a)} className="flex-1 text-left">
                                    <span className="text-xs font-bold text-slate-800 leading-snug">{a.title}</span>
                                    {a.organization && <p className="text-[10px] text-slate-400 mt-0.5">{a.organization}</p>}
                                    {a.repeat_next_date && a.repeat_next_date.length >= 10 && (
                                      <p className="text-[10px] text-slate-500 mt-0.5">
                                        Next: {new Date(a.repeat_next_date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                      </p>
                                    )}
                                  </button>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                                      {a.repeat_frequency ?? 'recurring'}
                                    </span>
                                    <button
                                      onClick={() => handleTogglePostpartumPost(a.id, a.type)}
                                      className={`text-[10px] font-black px-1.5 py-0.5 rounded transition-colors ${a.postpartum_post ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-400 hover:bg-violet-100 hover:text-violet-600'}`}
                                    >
                                      Post
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* Locations */}
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-violet-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">Locations</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-700 text-white">{locations.length}</span>
              </div>
              <button onClick={() => togglePostColFilter('locations')} className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-violet-200">Post</span>
                <div className={`w-7 h-4 rounded-full transition-colors relative ${postColFilter.locations === 'post' ? 'bg-white' : 'bg-violet-500'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full shadow transition-transform ${postColFilter.locations === 'post' ? 'bg-violet-600 translate-x-3.5' : 'bg-white translate-x-0.5'}`} />
                </div>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {(() => {
                const filtered = postColFilter.locations === 'post' ? locations.filter(l => l.postpartum_post) : locations
                if (filtered.length === 0) return <div className="py-10 text-center text-xs text-slate-400 italic">No locations saved</div>
                const complete = filtered.filter(l => l.url && l.description)
                const incomplete = filtered.filter(l => !l.url || !l.description)
                const renderCard = (loc: Location) => (
                  <div key={loc.id} className={`border rounded-lg px-3 py-2 ${loc.postpartum_post ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => setSelectedLocation(loc)} className="flex items-start gap-1.5 min-w-0 text-left hover:opacity-70 transition-opacity">
                        <MapPin size={11} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 leading-snug">{loc.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{loc.address}</p>
                          {loc.neighborhood && <p className="text-[10px] text-slate-400">{loc.neighborhood}{loc.area ? ` · ${loc.area}` : ''}</p>}
                        </div>
                      </button>
                      <button
                        onClick={() => handleToggleLocationPost(loc.id)}
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 transition-colors ${loc.postpartum_post ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-400 hover:bg-violet-100 hover:text-violet-600'}`}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )
                return (
                  <>
                    {[
                      { key: 'locations-incomplete', label: 'Needs info', items: incomplete },
                      { key: 'locations-complete', label: 'Ready', items: complete },
                    ].map(({ key, label, items }) => {
                      if (items.length === 0) return null
                      const collapsed = collapsedPostSections.has(key)
                      return (
                        <div key={key}>
                          <button
                            onClick={() => togglePostSection(key)}
                            className="w-full flex items-center gap-1.5 px-1 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                            {label}
                            <span className="ml-auto bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>
                          </button>
                          {!collapsed && <div className="space-y-1.5">{items.map(renderCard)}</div>}
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      ) : (activeTab === 'published' || activeTab === 'archived') ? (
        <div className="flex-1 overflow-y-auto">
          {selectedArchiveIds.size > 0 && (
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3">
              <span className="text-xs font-black text-slate-700">{selectedArchiveIds.size} selected</span>
              <button
                onClick={() => setSelectedArchiveIds(new Set(activeTabItems.map(a => a.id)))}
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
          {activeTab === 'published' ? (
            <div className="flex flex-col md:flex-row gap-2 p-2 min-h-0 flex-1">
              {([
                { label: 'Recurring', items: publishedRecurring },
                { label: 'Past',      items: publishedPast      },
                { label: 'Resources', items: publishedResources },
              ] as const).map(({ label, items }) => (
                <div key={label} className="flex-1 min-w-0 flex flex-col bg-slate-100 rounded-xl overflow-hidden">
                  <div className="p-4 bg-green-600 flex items-center justify-between">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-white">{label}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-700 text-white">{items.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {items.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400 italic">None</div>
                    ) : (
                      items.map(activity => (
                        <ArchivedCard
                          key={activity.id}
                          activity={activity}
                          onDetails={setSelectedActivity}
                          onRestore={handleRestoreEvent}
                          onDelete={handleDeleteActivity}
                          isSelected={selectedArchiveIds.has(activity.id)}
                          onToggleSelect={() => toggleArchiveSelect(activity.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-2 p-2 min-h-0 flex-1">
              <div className="flex-1 min-w-0 flex flex-col bg-slate-100 rounded-xl overflow-hidden">
                <div className="flex-1 overflow-y-auto p-2">
                  {archivedActivities.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400 italic">None</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {archivedActivities.map(activity => (
                        <ArchivedCard
                          key={activity.id}
                          activity={activity}
                          onDetails={setSelectedActivity}
                          onRestore={handleRestoreEvent}
                          onDelete={handleDeleteActivity}
                          isSelected={selectedArchiveIds.has(activity.id)}
                          onToggleSelect={() => toggleArchiveSelect(activity.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                .filter(e => e.list_id === col.id && e.status !== 'archived' && e.status !== 'published')
                .filter(e => col.id !== 'review' || e.type !== 'event' || !(e.end_date ? e.end_date < publishDate : (!!e.start_date && !e.repeat_rrule && e.start_date < publishDate)))
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
              onAddLocation={handleAddLocation}
              locations={locations.filter(l => l.list_id === col.id && l.status !== 'archived')}
              onLocationDetails={setSelectedLocation}
              onMoveLocation={handleMoveLocation}
              pastEvents={col.id === 'review' ? activities.filter(a =>
                  a.type === 'event' &&
                  a.list_id === 'review' &&
                  a.status !== 'archived' && a.status !== 'published' &&
                  (a.end_date ? a.end_date < publishDate : (!!a.start_date && !a.repeat_rrule && a.start_date < publishDate))
                ) : undefined}
              onArchive={handleArchiveEvent}
              publishDate={publishDate}
              color={activeTab === 'newsletter' ? 'blue' : 'orange'}
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
            const next = activities.filter(a => a.list_id === 'next_newsletter' && a.status !== 'archived' && a.status !== 'published')
            if (!next.length) return
            const eventIds    = next.filter(a => a.type === 'event').map(a => a.id)
            const resourceIds = next.filter(a => a.type === 'resource').map(a => a.id)
            const d = new Date(publishDate); d.setUTCDate(d.getUTCDate() + 14)
            const newPublishDate = d.toISOString().split('T')[0]
            setActivities(prev => prev.map(a =>
              next.some(n => n.id === a.id)
                ? { ...a, newsletter_last: publishDate, status: 'published' as const }
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

      {selectedLocation && (
        <LocationDrawer
          location={locations.find(l => l.id === selectedLocation.id) ?? selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onSaved={(loc) => {
            setLocations(prev => prev.map(l => l.id === loc.id ? loc : l))
            setSelectedLocation(null)
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
