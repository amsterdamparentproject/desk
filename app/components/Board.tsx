'use client';

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Column, LocationCard } from './Column'
import { ActivityCard } from './card'
import { CaptureDataProps, createNewActivity, DeskActivity, Location, Service } from '../types/activity'
import { ALL_LISTS, NEWSLETTER_LISTS, TRIAGE_LISTS, ListId, Tab } from '../types/list'
import { ActivityDrawer } from './ActivityDrawer'
import { LocationDrawer } from './LocationDrawer'
import { LocationForm } from './card'
import {
  advanceLocation,
  archiveActivity,
  createActivity,
  createLocation,
  decideLocationPost,
  deleteActivity,
  deleteLocation,
  finishNewsletterIssue,
  moveActivity,
  pollForUpdates,
  saveActivity,
  sweepStaleUpcoming,
  uploadActivityFile,
} from '../actions/activities'
import { Check, Newspaper, RotateCcw, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
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

  // Archived tab mixes explicit triage rejects with items that just aged out
  // without ever being rejected — status is the only thing that tells them apart.
  const agedOutBadge = activity.status !== 'archived' && activity.status !== 'published'

  return (
    <Card activity={activity} onDetails={onDetails} detailsAction={checkbox}>
      {agedOutBadge && (
        <div className="px-3">
          <span className="inline-block text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            Timed out, not rejected
          </span>
        </div>
      )}
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

// Included tab is a cross-cutting "what's currently live, regardless of stage"
// overview — the status badge is the whole point, since accepted vs published
// is the only thing distinguishing "still pending" from "already sent".
function IncludedCard({ activity, onDetails }: { activity: DeskActivity; onDetails: (a: DeskActivity) => void }) {
  const badgeClass = activity.status === 'published'
    ? 'text-teal-600 bg-teal-50 border-teal-200'
    : 'text-green-600 bg-green-50 border-green-200'
  return (
    <Card activity={activity} onDetails={onDetails}>
      <div className="px-3 pb-3">
        <span className={`inline-block text-[9px] font-black uppercase tracking-widest border rounded px-1.5 py-0.5 ${badgeClass}`}>
          {activity.status}
        </span>
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
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const [activities, setActivities] = useState<DeskActivity[]>(initialActivities)
  const [selectedActivity, setSelectedActivity] = useState<DeskActivity | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [newsletterOpen, setNewsletterOpen] = useState(false)

  // URL-driven drawer: ?type=event|resource|location&id=<uuid>
  useEffect(() => {
    const id   = searchParams.get('id')
    const type = searchParams.get('type')
    if (!id || !type) return
    if (type === 'location') {
      const loc = initialLocations.find(l => l.id === id)
      if (loc) setSelectedLocation(loc)
    } else {
      const act = initialActivities.find(a => a.id === id)
      if (act) setSelectedActivity(act)
    }
  }, [])

  const openActivity = useCallback((activity: DeskActivity) => {
    setSelectedActivity(activity)
    router.replace(`?type=${activity.type}&id=${activity.id}`, { scroll: false })
  }, [router])

  const openLocation = useCallback((loc: Location) => {
    setSelectedLocation(loc)
    router.replace(`?type=location&id=${loc.id}`, { scroll: false })
  }, [router])

  const closeDrawer = useCallback(() => {
    setSelectedActivity(null)
    setSelectedLocation(null)
    router.replace('?', { scroll: false })
  }, [router])
  const processingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const disarmProcessingTimeout = (id: string) => {
    const t = processingTimeouts.current.get(id)
    if (t !== undefined) { clearTimeout(t); processingTimeouts.current.delete(id) }
  }
  const [openCols, setOpenCols] = useState<Set<ListId>>(() => {
    const allIds = [...TRIAGE_LISTS, ...NEWSLETTER_LISTS].map(col => col.id)
    return new Set(allIds)
  })
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const toggleSection = (key: string) =>
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

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
      // Preserve the current activities state value for postpartum_post to prevent a stale
      // drawer blur-save from overwriting a recent inline Post button toggle.
      postpartum_post: original?.postpartum_post ?? updated.postpartum_post,
      status: 'accepted' as const,
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
      ? { ...updated, status: 'archived' as const, list_id: 'gone' as ListId }
      : { ...updated, list_id: targetList, status: 'accepted' as const, ...(delta !== undefined ? { newsletter_last: delta } : {}) }
    setActivities(prev => prev.map(e => e.id === updated.id ? withListAndStatus : e))
    closeDrawer()
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
    const delta = newsletterLastDelta(activity.list_id, targetList, activity.newsletter_last)

    // Refine -> Upcoming is where "is it good for newsletter/post" gets decided.
    // Default both services on (editable via toggle afterward), and stamp
    // 'accepted' — the status that reflects "confirmed, in the active pipeline".
    const isPromotionToUpcoming = activity.list_id === 'refine' && (targetList === 'upcoming_events' || targetList === 'new_resources')
    const nextServices: Service[] = isPromotionToUpcoming && activity.services.length === 0
      ? ['newsletter', 'postpartum_post']
      : activity.services
    const newStatus = targetList === 'capture' ? 'processing' as const : isPromotionToUpcoming ? 'accepted' as const : activity.status

    const updated: DeskActivity = {
      ...activity,
      list_id: targetList,
      status: newStatus,
      services: nextServices,
      postpartum_post: nextServices.includes('postpartum_post'),
      ...(delta !== undefined ? { newsletter_last: delta } : {}),
    }
    setActivities(prev => prev.map(e => e.id === id ? updated : e))
    try {
      if (isPromotionToUpcoming) {
        await saveActivity(id, activity.type, updated)
      } else {
        await moveActivity(id, activity.type, targetList, targetList === 'capture' ? 'processing' : undefined, delta)
      }
    } catch (err) {
      console.error('Move failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? activity : e))
    }
  }

  // Card-front Newsletter/Post toggle — two-way, replaces the old one-way
  // "Skip issue"/"Skip match" buttons and works from any tab/stage. Dropping
  // the last remaining service on an item already in the Upcoming/Next
  // pipeline moves it to 'gone'; picking one back up never needs to move it
  // (services only get seeded once a card is actually promoted to Upcoming).
  const handleToggleService = async (id: string, service: Service, enabled: boolean) => {
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    const nextServices = enabled
      ? Array.from(new Set([...activity.services, service]))
      : activity.services.filter(s => s !== service)
    const inServiceStage = activity.list_id === 'upcoming_events' || activity.list_id === 'new_resources' || activity.list_id === 'next_newsletter'
    const becameEmpty = inServiceStage && nextServices.length === 0
    const updated: DeskActivity = {
      ...activity,
      services: nextServices,
      postpartum_post: nextServices.includes('postpartum_post'),
      ...(becameEmpty ? { list_id: 'gone' as ListId } : {}),
    }
    setActivities(prev => prev.map(e => e.id === id ? updated : e))
    try {
      await saveActivity(id, activity.type, { services: nextServices })
    } catch (err) {
      console.error('Toggle service failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? activity : e))
    }
  }

  const handleArchiveEvent = async (id: string) => {
    const activity = activities.find(e => e.id === id)
    if (!activity) return
    setActivities(prev => prev.map(e => e.id === id ? { ...e, status: 'archived' as const, list_id: 'gone' as ListId } : e))
    try {
      await archiveActivity(id, activity.type)
    } catch (err) {
      console.error('Archive failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? { ...e, status: activity.status, list_id: activity.list_id } : e))
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
    // Restoring out of 'gone' needs a real landing spot — send it back to review
    // for a fresh look, and clear the issue stamp so it doesn't still read as published.
    const restored = { ...activity, status: 'accepted' as const, list_id: 'review' as ListId, newsletter_last: null }
    setActivities(prev => prev.map(e => e.id === id ? restored : e))
    try {
      await saveActivity(id, activity.type, restored)
    } catch (err) {
      console.error('Restore failed:', err)
      setActivities(prev => prev.map(e => e.id === id ? { ...e, status: activity.status, list_id: activity.list_id, newsletter_last: activity.newsletter_last } : e))
    }
  }

  // --- Location handlers -----------------------------------------------
  // Locations bypass the Activities triage tab entirely and have their own,
  // simpler lifecycle: Review -> Refine -> Gone. No 'services' array, no
  // expiry, and no archived state — a location is either accepted or deleted.
  const handleAddLocation = async (data: { name: string; address: string; area?: string | null; neighborhood?: string | null }) => {
    try {
      const loc = await createLocation(data)
      setLocations(prev => [...prev, loc].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('createLocation failed:', err)
    }
  }

  const handleAdvanceLocation = async (id: string) => {
    const loc = locations.find(l => l.id === id)
    if (!loc) return
    setLocations(prev => prev.map(l => l.id === id ? { ...l, list_id: 'refine' as ListId } : l))
    try {
      await advanceLocation(id)
    } catch (err) {
      console.error('advanceLocation failed:', err)
      setLocations(prev => prev.map(l => l.id === id ? loc : l))
    }
  }

  const handleDecideLocationPost = async (id: string, inPost: boolean) => {
    const loc = locations.find(l => l.id === id)
    if (!loc) return
    setLocations(prev => prev.map(l => l.id === id ? { ...l, list_id: 'gone' as ListId, status: 'accepted' as const, postpartum_post: inPost } : l))
    try {
      await decideLocationPost(id, inPost)
    } catch (err) {
      console.error('decideLocationPost failed:', err)
      setLocations(prev => prev.map(l => l.id === id ? loc : l))
    }
  }

  const handleDeleteLocation = async (id: string) => {
    const loc = locations.find(l => l.id === id)
    setLocations(prev => prev.filter(l => l.id !== id))
    try {
      await deleteLocation(id)
    } catch (err) {
      console.error('deleteLocation failed:', err)
      if (loc) setLocations(prev => [...prev, loc])
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
    const listId = captureData.list_id || 'capture'
    // Items captured directly into Upcoming (e.g. via the inline-add on the
    // Newsletter/Post tab's Upcoming column) skip the Refine promotion step
    // that normally seeds 'services' — default both on here so they don't
    // silently fail to appear in either tab's filtered view. Post never takes
    // resources (the Postpartum Post matcher only queries events, locations,
    // and playgrounds), so resources only ever get seeded 'newsletter'.
    const seedServices: Service[] = (listId === 'upcoming_events' || listId === 'new_resources')
      ? (type === 'event' ? ['newsletter', 'postpartum_post'] : ['newsletter'])
      : []

    // Generate ID upfront so the storage path matches the DB record
    const id = crypto.randomUUID()

    if (captureData.use_ai) {
      const optimistic = createNewActivity(description, {
        id, type,
        list_id: listId,
        status: 'processing',
        services: seedServices,
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
          list_id: listId,
          status: 'processing',
          services: seedServices,
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
    const processingIds = new Set(processingMeta.map(p => p.id))
    const intervalId = setInterval(async () => {
      const fetched = await pollForUpdates(processingMeta)
      setActivities(prev => {
        const fetchedMap = new Map(fetched.map(a => [a.id, a]))
        const existingIds = new Set(prev.map(a => a.id))
        // pollForUpdates also does a broad "recent review items" catch-all so
        // it can discover new sibling records the AI split out of one
        // submission — but that same catch-all can return an item the user
        // has already moved elsewhere locally (e.g. approved out of Review)
        // whose save just hasn't landed in the DB yet. Only let this poll
        // overwrite an item we're actually watching (the processing set);
        // anything else it returns is either brand new or safe to leave alone.
        const updated = prev.map(a =>
          processingIds.has(a.id) && fetchedMap.has(a.id)
            ? { ...fetchedMap.get(a.id)!, file: a.file, preview_url: a.preview_url }
            : a
        )
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

  // 'error' is folded into the Capture column as a collapsible section instead
  // of its own top-level column — stays in TRIAGE_LISTS (and ALL_LISTS) so
  // finishTarget/finishLabel lookups still work, just excluded from the map below.
  // Post has no ListProps entry — its three sections (Upcoming events,
  // Recurring Events, Match) are computed splits rendered as bespoke lists
  // further down, not through the generic Column component.
  const currentColumns =
    activeTab === 'triage'    ? TRIAGE_LISTS.filter(l => l.id !== 'error') :
    activeTab === 'newsletter' ? NEWSLETTER_LISTS :
    []
  const byUpdatedDesc = (a: DeskActivity, b: DeskActivity) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()

  // Published = actually sent in a newsletter issue (status independent of list_id —
  // a dual-tagged item can be 'published' for newsletter while list_id stays put
  // because it's still alive for Post). Archived = fully exited (list_id 'gone')
  // and never published — this bucket mixes explicit triage rejects (status:
  // archived) with items that just aged out without ever being rejected (status:
  // accepted); the ArchivedCard badge distinguishes the two.
  const publishedActivities = activities.filter(e => e.status === 'published').sort(byUpdatedDesc)
  const archivedActivities = activities.filter(e => e.list_id === 'gone' && e.status !== 'published').sort(byUpdatedDesc)
  const activeTabItems = activeTab === 'published' ? publishedActivities : activeTab === 'archived' ? archivedActivities : []

  // Group published activities by the newsletter issue they went out in, newest first.
  const publishedByIssue: [string, DeskActivity[]][] = (() => {
    const groups = new Map<string, DeskActivity[]>()
    for (const a of publishedActivities) {
      const key = a.newsletter_last ?? 'unknown'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(a)
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  })()

  // Included: a cross-cutting view of everything currently "live" regardless of
  // pipeline stage — status accepted or published. Just two flat groups,
  // most recently modified first.
  const includedActivities = activities.filter(a => a.status === 'accepted' || a.status === 'published')
  const includedEvents = includedActivities.filter(a => a.type === 'event').sort(byUpdatedDesc)
  const includedResources = includedActivities.filter(a => a.type === 'resource').sort(byUpdatedDesc)

  // Post tab: events tagged postpartum_post, still active in Upcoming. Post
  // never takes resources — the Postpartum Post matcher only queries events,
  // locations, and playgrounds — so this pool (and everything derived from
  // it below) is events-only, unlike Newsletter's dual-type Upcoming.
  // Note: 'published' here means "went out in a newsletter issue" — that's a
  // newsletter-cycle concept, not a Post one, so it must NOT exclude items.
  // A recurring (or even single) event tagged postpartum_post stays eligible
  // for Post regardless of its newsletter status; only an explicit archive
  // (rejected) or leaving upcoming_events (aged out via sweepStaleUpcoming,
  // or moved to 'gone') removes it.
  const postEffectiveDate = (a: DeskActivity) => a.repeat_next_date ?? a.start_date ?? null
  const byPostDate = (a: DeskActivity, b: DeskActivity) =>
    (postEffectiveDate(a) ?? '').localeCompare(postEffectiveDate(b) ?? '')
  const postEvents = activities.filter(a =>
    a.type === 'event' &&
    a.list_id === 'upcoming_events' &&
    a.status !== 'archived' &&
    a.services.includes('postpartum_post')
  )
  // Every card shows up in exactly one Post column, and stays included
  // unless explicitly removed: recurring events live only in "Recurring"
  // (repeat_rrule is the authoritative "does this event recur" flag);
  // non-recurring events are split between "This match" (due by the end of
  // this month, including anything overdue that hasn't been swept yet) and
  // "Future match" (everything after that, with no upper bound) — so a
  // single event can never silently fall through a gap between columns
  // regardless of how far out (or overdue) its date is.
  const postRecurringEvents = postEvents.filter(a => !!a.repeat_rrule).sort(byPostDate)
  const postSingleEvents = postEvents.filter(a => !a.repeat_rrule)
  const matchThisMonthEnd = (() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(0)
    return d.toISOString().split('T')[0]
  })()
  const matchThisMonth = postSingleEvents.filter(a => {
    const d = postEffectiveDate(a)
    return !!d && d <= matchThisMonthEnd
  }).sort(byPostDate)
  const matchNextMonth = postSingleEvents.filter(a => {
    const d = postEffectiveDate(a)
    return !!d && d > matchThisMonthEnd
  }).sort(byPostDate)

  // Locations tab groups
  const reviewLocations = locations.filter(l => l.list_id === 'review')
  const refineLocations = locations.filter(l => l.list_id === 'refine')
  const goneLocations = locations.filter(l => l.list_id === 'gone')
  const inPostLocations = goneLocations.filter(l => l.postpartum_post)
  const notInPostLocations = goneLocations.filter(l => !l.postpartum_post)

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 z-10">
        <div className="flex px-4 gap-8 items-center justify-between">
          <div className="flex gap-8 overflow-x-auto">
            {(['triage', 'newsletter', 'post', 'locations', 'published', 'included', 'archived'] as Tab[]).map((tab) => {
              const isDesktopOnly = tab === 'published' || tab === 'included' || tab === 'archived'
              const activeColor =
                tab === 'archived'  ? 'text-red-500' :
                tab === 'published' ? 'text-green-600' :
                tab === 'included'  ? 'text-indigo-600' :
                tab === 'locations' ? 'text-fuchsia-600' :
                tab === 'post'      ? 'text-violet-600' :
                tab === 'triage'    ? 'text-orange-500' :
                'text-blue-600'
              const label = tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 text-xs sm:text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${isDesktopOnly ? 'hidden md:block' : ''} ${activeTab === tab ? activeColor : 'text-slate-400 hover:text-slate-600'}`}
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

      {(activeTab === 'published' || activeTab === 'included' || activeTab === 'archived') ? (
        <div className="flex-1 overflow-y-auto">
          {activeTab !== 'included' && selectedArchiveIds.size > 0 && (
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
            <div className="p-2 space-y-2">
              {publishedByIssue.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 italic">Nothing published yet</div>
              ) : publishedByIssue.map(([issueDate, items]) => {
                const key = `issue-${issueDate}`
                const collapsed = collapsedSections.has(key)
                const issueLabel = issueDate === 'unknown'
                  ? 'Unknown issue'
                  : new Date(issueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                return (
                  <div key={issueDate} className="bg-slate-100 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection(key)}
                      className="w-full p-4 bg-green-600 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {collapsed ? <ChevronRight size={14} className="text-white" /> : <ChevronDown size={14} className="text-white" />}
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-white">{issueLabel}</h2>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-700 text-white">{items.length}</span>
                    </button>
                    {!collapsed && (
                      <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {items.map(activity => (
                          <ArchivedCard
                            key={activity.id}
                            activity={activity}
                            onDetails={openActivity}
                            onRestore={handleRestoreEvent}
                            onDelete={handleDeleteActivity}
                            isSelected={selectedArchiveIds.has(activity.id)}
                            onToggleSelect={() => toggleArchiveSelect(activity.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : activeTab === 'included' ? (
            <div className="p-2 space-y-2">
              {includedEvents.length === 0 && includedResources.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 italic">Nothing included yet</div>
              ) : (
                ([
                  { key: 'included-events', label: 'Events', items: includedEvents },
                  { key: 'included-resources', label: 'Resources', items: includedResources },
                ] as const).map(({ key, label, items }) => {
                  if (items.length === 0) return null
                  const collapsed = collapsedSections.has(key)
                  return (
                    <div key={key} className="bg-slate-100 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection(key)}
                        className="w-full p-4 bg-indigo-600 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {collapsed ? <ChevronRight size={14} className="text-white" /> : <ChevronDown size={14} className="text-white" />}
                          <h2 className="text-[10px] font-black uppercase tracking-widest text-white">{label}</h2>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-700 text-white">{items.length}</span>
                      </button>
                      {!collapsed && (
                        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {items.map(activity => (
                            <IncludedCard key={activity.id} activity={activity} onDetails={openActivity} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="p-2">
              {archivedActivities.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 italic">None</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {archivedActivities.map(activity => (
                    <ArchivedCard
                      key={activity.id}
                      activity={activity}
                      onDetails={openActivity}
                      onRestore={handleRestoreEvent}
                      onDelete={handleDeleteActivity}
                      isSelected={selectedArchiveIds.has(activity.id)}
                      onToggleSelect={() => toggleArchiveSelect(activity.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'locations' ? (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
          {/* Review */}
          <div className="w-full md:flex-1 md:basis-0 min-w-0">
            <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
              <div className="p-4 bg-violet-600 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">Review</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-700 text-white">{reviewLocations.length}</span>
              </div>
              <div className="p-3 space-y-3 bg-slate-100">
                <LocationForm onAddLocation={handleAddLocation} locations={locations} />
                {reviewLocations.length === 0 ? (
                  <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">Nothing to see here 🌬️</div>
                ) : reviewLocations.map(loc => (
                  <LocationCard key={loc.id} location={loc} onDetails={openLocation} onAdvance={handleAdvanceLocation} />
                ))}
              </div>
            </section>
          </div>

          {/* Refine */}
          <div className="w-full md:flex-1 md:basis-0 min-w-0">
            <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
              <div className="p-4 bg-violet-600 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">Refine</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-700 text-white">{refineLocations.length}</span>
              </div>
              <div className="p-3 space-y-3 bg-slate-100">
                {refineLocations.length === 0 ? (
                  <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">Nothing to see here 🌬️</div>
                ) : refineLocations.map(loc => (
                  <LocationCard key={loc.id} location={loc} onDetails={openLocation} onDecide={handleDecideLocationPost} />
                ))}
              </div>
            </section>
          </div>

          {/* Settled: In Post / Not in Post */}
          <div className="w-full md:flex-1 md:basis-0 min-w-0">
            <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
              <div className="p-4 bg-green-600 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">Settled</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-700 text-white">{goneLocations.length}</span>
              </div>
              <div className="p-3 space-y-3 bg-slate-100">
                {goneLocations.length === 0 ? (
                  <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">Nothing to see here 🌬️</div>
                ) : (
                  ([
                    { label: 'In Post', items: inPostLocations },
                    { label: 'Not in Post', items: notInPostLocations },
                  ] as const).map(({ label, items }) => {
                    if (items.length === 0) return null
                    const key = `locations-${label}`
                    const collapsed = collapsedSections.has(key)
                    return (
                      <div key={label}>
                        <button
                          type="button"
                          onClick={() => toggleSection(key)}
                          className="w-full flex items-center gap-1.5 px-1 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                          {label}
                          <span className="ml-auto bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">{items.length}</span>
                        </button>
                        {!collapsed && (
                          <div className="space-y-3">
                            {items.map(loc => (
                              <LocationCard key={loc.id} location={loc} onDetails={openLocation} />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
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
                // Newsletter-owned stages only show items still tagged 'newsletter' —
                // dropping the service (Skip issue) hides it here without moving
                // list_id, since it may still be alive for Post.
                .filter(e => {
                  if (activeTab === 'newsletter' && (['upcoming_events', 'new_resources', 'next_newsletter'] as ListId[]).includes(col.id)) {
                    return e.services.includes('newsletter')
                  }
                  return true
                })
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
              onDetails={openActivity}
              onMove={handleMoveEvent}
              onAddEvent={handleAddEvent}
              pastEvents={col.id === 'review' ? activities.filter(a =>
                  a.type === 'event' &&
                  a.list_id === 'review' &&
                  a.status !== 'archived' && a.status !== 'published' &&
                  (a.end_date ? a.end_date < publishDate : (!!a.start_date && !a.repeat_rrule && a.start_date < publishDate))
                ) : undefined}
              // 'Errors' (list_id: error) and 'New' (list_id: capture — a rare
              // legacy fallback) are folded under Capture as collapsible
              // sections instead of their own top-level columns.
              extraGroups={col.id === 'ideas' ? [
                { key: 'error', label: 'Errors', activities: activities.filter(a => a.list_id === 'error' && a.status !== 'archived' && a.status !== 'published') },
                { key: 'capture-new', label: 'New', activities: activities.filter(a => a.list_id === 'capture' && a.status !== 'archived' && a.status !== 'published') },
              ] : undefined}
              onArchive={handleArchiveEvent}
              onToggleService={handleToggleService}
              publishDate={publishDate}
              color={activeTab === 'newsletter' ? 'blue' : 'orange'}
            />
          </div>
        ))}

        {activeTab === 'post' && (
          <>
            {([
              { key: 'post-this-match',   label: 'This match',   items: matchThisMonth },
              { key: 'post-future-match', label: 'Future match', items: matchNextMonth },
              { key: 'post-recurring',    label: 'Recurring',    items: postRecurringEvents },
            ] as const).map(({ key, label, items }) => (
              <div key={key} className="w-full md:flex-1 md:basis-0 min-w-0">
                <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
                  <div className="p-4 bg-violet-600 flex items-center justify-between">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-white">{label}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-700 text-white">{items.length}</span>
                  </div>
                  <div className="p-3 space-y-3 bg-slate-100">
                    {items.length === 0 ? (
                      <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">Nothing to see here 🌬️</div>
                    ) : (
                      items.map(activity => (
                        <ActivityCard
                          key={activity.id}
                          activity={activity}
                          onDetails={openActivity}
                          onArchive={handleArchiveEvent}
                          onToggleService={handleToggleService}
                          showNotInPost
                        />
                      ))
                    )}
                  </div>
                </section>
              </div>
            ))}
          </>
        )}
      </div>
      )}

      {newsletterOpen && (
        <NewsletterDrawer
          activities={activities}
          publishDate={publishDate}
          onPublishDateChange={handlePublishDateChange}
          onClose={() => setNewsletterOpen(false)}
          onFinishIssue={async () => {
            const next = activities.filter(a => a.list_id === 'next_newsletter' && a.status !== 'archived' && a.status !== 'published' && a.services.includes('newsletter'))
            const today = new Date().toISOString().split('T')[0]
            // Non-recurring Upcoming events that never made it into an issue and
            // whose date has already passed — drop 'newsletter' from services
            // (status untouched — they weren't rejected or published, just aged out).
            const staleUpcoming = activities.filter(a =>
              a.type === 'event' && a.list_id === 'upcoming_events' && !a.repeat_rrule &&
              a.status !== 'archived' && a.status !== 'published' &&
              (a.end_date ? a.end_date < today : (!!a.start_date && a.start_date < today))
            )
            if (!next.length) return
            const eventIds    = next.filter(a => a.type === 'event').map(a => a.id)
            const resourceIds = next.filter(a => a.type === 'resource').map(a => a.id)
            const d = new Date(publishDate); d.setUTCDate(d.getUTCDate() + 14)
            const newPublishDate = d.toISOString().split('T')[0]
            setActivities(prev => prev.map(a => {
              if (next.some(n => n.id === a.id)) {
                const nextServices = a.services.filter(s => s !== 'newsletter')
                const becameEmpty = nextServices.length === 0
                // Still tagged postpartum_post after dropping newsletter? Move
                // back to the Upcoming stage rather than leaving list_id at
                // 'next_newsletter' — Post's Match/Upcoming panels require
                // list_id === 'upcoming_events'/'new_resources', so leaving it
                // put would make the item invisible everywhere despite still
                // being active. Mirrors finishNewsletterIssue server-side.
                return {
                  ...a,
                  newsletter_last: publishDate,
                  status: 'published' as const,
                  services: nextServices,
                  postpartum_post: nextServices.includes('postpartum_post'),
                  list_id: (becameEmpty ? 'gone' : (a.type === 'event' ? 'upcoming_events' : 'new_resources')) as ListId,
                }
              }
              if (staleUpcoming.some(s => s.id === a.id)) {
                const nextServices = a.services.filter(s => s !== 'newsletter')
                return {
                  ...a,
                  services: nextServices,
                  postpartum_post: nextServices.includes('postpartum_post'),
                  ...(nextServices.length === 0 ? { list_id: 'gone' as ListId } : {}),
                }
              }
              return a
            }))
            handlePublishDateChange(newPublishDate)
            setNewsletterOpen(false)
            await Promise.all([
              finishNewsletterIssue(eventIds, resourceIds, publishDate),
              sweepStaleUpcoming(staleUpcoming.map(a => a.id)),
            ]).catch(err => console.error('Failed to finish newsletter issue:', err))
          }}
        />
      )}

      {selectedActivity && (
        <ActivityDrawer
          activity={activities.find(e => e.id === selectedActivity.id) ?? selectedActivity}
          onSaveDraft={handleSaveDraft}
          onFinishEditing={handleFinishEditing}
          onClose={closeDrawer}
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
          onToggleService={(service, enabled) => handleToggleService(selectedActivity.id, service, enabled)}
        />
      )}

      {selectedLocation && (
        <LocationDrawer
          location={locations.find(l => l.id === selectedLocation.id) ?? selectedLocation}
          onClose={closeDrawer}
          onSaved={(loc) => {
            setLocations(prev => prev.map(l => l.id === loc.id ? loc : l))
            closeDrawer()
          }}
          onDelete={handleDeleteLocation}
        />
      )}
    </main>
  )
}
