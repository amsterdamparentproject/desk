'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { oneOf, usePersistedState } from '../hooks/usePersistedState'
import { LocationCard } from './Column'
import { DeskTable } from './DeskTable'
import { isDoneRow, isHeld, isPostEligible } from '@/lib/desk-table'
import {
  CaptureDataProps,
  createNewActivity,
  DeskActivity,
  Location,
  Service,
} from '../types/activity'
import { ListId, Tab } from '../types/list'
import { isIsoDate } from '@/lib/issue-date'
import { ActivityDrawer } from './ActivityDrawer'
import { LocationDrawer } from './LocationDrawer'
import { LocationForm } from './card'
import {
  archiveActivity,
  convertActivityType,
  createActivity,
  createLocation,
  saveIssueDate,
  decideLocationPost,
  deleteActivity,
  deleteLocation,
  finishNewsletterIssue,
  flagParseError,
  pollForUpdates,
  saveActivity,
  sweepStaleUpcoming,
  uploadActivityFile,
} from '../actions/activities'
import { Newspaper, ChevronDown, ChevronRight } from 'lucide-react'
import { NewsletterDrawer } from './NewsletterDrawer'

interface BoardProps {
  initialActivities: DeskActivity[]
  initialLocations?: Location[]
  // Shared issue date from the DB (already rolled forward server-side).
  initialPublishDate?: string
}

// /api/desk/send forwards n8n's outcome in its JSON body; fold it into the
// error so a 403 (bad secret), 404 (workflow inactive / wrong URL) or a config
// error is visible in the console instead of a bare "502".
async function webhookFailure(res: Response): Promise<Error> {
  const detail = await res.json().catch(() => null)
  const upstream = [
    detail?.status ? `n8n responded ${detail.status}` : null,
    detail?.error ?? null,
  ]
    .filter(Boolean)
    .join(': ')
  return new Error(
    `Webhook failed with status ${res.status}${upstream ? ` (${upstream})` : ''}`
  )
}

export default function Board({
  initialActivities,
  initialLocations = [],
  initialPublishDate = '',
}: BoardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [locations, setLocations] = useState<Location[]>(initialLocations)
  const [activeTab, setActiveTab] = usePersistedState<Tab>(
    'desk:tab',
    'triage',
    oneOf(['triage', 'newsletter', 'post', 'locations', 'done'] as const)
  )
  // Falls back to today if the server couldn't supply one, so the issue
  // window is never empty or NaN.
  const [publishDate, setPublishDate] = useState(() =>
    isIsoDate(initialPublishDate)
      ? initialPublishDate
      : new Date().toLocaleDateString('en-CA')
  )

  const handlePublishDateChange = (date: string) => {
    setPublishDate(date)
    saveIssueDate(date).catch((err) =>
      console.error('Saving issue date failed:', err)
    )
  }

  const [activities, setActivities] =
    useState<DeskActivity[]>(initialActivities)
  // URL-driven drawer: ?type=event|resource|location&id=<uuid>
  const urlId = searchParams.get('id')
  const urlType = searchParams.get('type')
  const [selectedActivity, setSelectedActivity] = useState<DeskActivity | null>(
    () =>
      urlId && urlType && urlType !== 'location'
        ? (initialActivities.find((a) => a.id === urlId) ?? null)
        : null
  )
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    () =>
      urlId && urlType === 'location'
        ? (initialLocations.find((l) => l.id === urlId) ?? null)
        : null
  )
  const [newsletterOpen, setNewsletterOpen] = useState(false)

  const openActivity = useCallback(
    (activity: DeskActivity) => {
      setSelectedActivity(activity)
      router.replace(`?type=${activity.type}&id=${activity.id}`, {
        scroll: false,
      })
    },
    [router]
  )

  const openLocation = useCallback(
    (loc: Location) => {
      setSelectedLocation(loc)
      router.replace(`?type=location&id=${loc.id}`, { scroll: false })
    },
    [router]
  )

  const closeDrawer = useCallback(() => {
    setSelectedActivity(null)
    setSelectedLocation(null)
    router.replace('?', { scroll: false })
  }, [router])
  const processingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  const disarmProcessingTimeout = useCallback((id: string) => {
    const t = processingTimeouts.current.get(id)
    if (t !== undefined) {
      clearTimeout(t)
      processingTimeouts.current.delete(id)
    }
  }, [])
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  )
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const handleSaveDraft = async (updated: DeskActivity) => {
    const original = activities.find((e) => e.id === updated.id)
    const withStatus = {
      ...updated,
      // Preserve the current activities state value for postpartum_post to prevent a stale
      // drawer blur-save from overwriting a recent inline Post button toggle.
      postpartum_post: original?.postpartum_post ?? updated.postpartum_post,
      status:
        updated.status === 'new' ? ('processed' as const) : updated.status,
    }
    setActivities((prev) =>
      prev.map((e) => (e.id === updated.id ? withStatus : e))
    )
    try {
      await saveActivity(updated.id, updated.type, withStatus)
    } catch (err) {
      console.error('Save draft failed:', err)
    }
  }

  const handleFinishEditing = async (updated: DeskActivity) => {
    const today = new Date().toISOString().split('T')[0]
    const isPastEvent =
      updated.type === 'event' &&
      !updated.repeat_frequency &&
      updated.start_date &&
      updated.start_date < today
    const shouldArchive = updated.list_id === 'inbox' && isPastEvent

    const withListAndStatus = shouldArchive
      ? {
          ...updated,
          status: 'archived' as const,
          list_id: 'done' as ListId,
          in_next_issue: false,
        }
      : {
          ...updated,
          list_id: 'refined' as ListId,
          status: 'processed' as const,
        }
    setActivities((prev) =>
      prev.map((e) => (e.id === updated.id ? withListAndStatus : e))
    )
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

  // Newsletter table action: flag a refined row for (or remove it from) the
  // next issue. Stage stays 'refined'; only in_next_issue changes.
  const handleToggleNextIssue = async (id: string, inNext: boolean) => {
    const activity = activities.find((e) => e.id === id)
    if (!activity) return
    const patch = { in_next_issue: inNext }
    setActivities((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    )
    try {
      await saveActivity(id, activity.type, patch)
    } catch (err) {
      console.error('Toggle next issue failed:', err)
      setActivities((prev) => prev.map((e) => (e.id === id ? activity : e)))
    }
  }

  // Table action "Done refining": the inbox row graduates to Refined. Newsletter
  // and Post tabs then pick it up from its services.
  const handleDoneRefining = async (id: string) => {
    const activity = activities.find((e) => e.id === id)
    if (!activity) return
    if (activity.services.length === 0) return
    const patch = { list_id: 'refined' as ListId, status: 'processed' as const }
    setActivities((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    )
    try {
      await saveActivity(id, activity.type, patch)
    } catch (err) {
      console.error('Done refining failed:', err)
      setActivities((prev) => prev.map((e) => (e.id === id ? activity : e)))
    }
  }

  // Card-front Newsletter/Post toggle — two-way, replaces the old one-way
  // "Skip issue"/"Skip match" buttons and works from any tab/stage. Dropping
  // the last remaining service on an item already in the Upcoming/Next
  // pipeline moves it to 'done'; picking one back up never needs to move it
  // (services only get seeded once a card is actually promoted to Upcoming).
  const handleToggleService = async (
    id: string,
    service: Service,
    enabled: boolean
  ) => {
    const activity = activities.find((e) => e.id === id)
    if (!activity) return
    const nextServices = enabled
      ? Array.from(new Set([...activity.services, service]))
      : activity.services.filter((s) => s !== service)
    const becameEmpty =
      activity.list_id === 'refined' && nextServices.length === 0
    const updated: DeskActivity = {
      ...activity,
      services: nextServices,
      postpartum_post: nextServices.includes('postpartum_post'),
      ...(becameEmpty
        ? { list_id: 'done' as ListId, in_next_issue: false }
        : {}),
    }
    setActivities((prev) => prev.map((e) => (e.id === id ? updated : e)))
    try {
      await saveActivity(id, activity.type, {
        services: nextServices,
        postpartum_post: nextServices.includes('postpartum_post'),
        ...(becameEmpty ? { list_id: 'done', in_next_issue: false } : {}),
      } as Partial<DeskActivity>)
    } catch (err) {
      console.error('Toggle service failed:', err)
      setActivities((prev) => prev.map((e) => (e.id === id ? activity : e)))
    }
  }

  const handleArchiveEvent = async (id: string) => {
    const activity = activities.find((e) => e.id === id)
    if (!activity) return
    setActivities((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'archived' as const,
              list_id: 'done' as ListId,
              in_next_issue: false,
            }
          : e
      )
    )
    try {
      await archiveActivity(id, activity.type)
    } catch (err) {
      console.error('Archive failed:', err)
      setActivities((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: activity.status, list_id: activity.list_id }
            : e
        )
      )
    }
  }

  // Returns the changed fields so the open drawer can mirror them, or null if
  // the conversion failed (nothing changed in that case).
  const handleConvertType = async (
    id: string,
    to: 'event' | 'resource'
  ): Promise<Record<string, unknown> | null> => {
    const activity = activities.find((e) => e.id === id)
    if (!activity || activity.type === to) return null
    try {
      const patch = await convertActivityType(id, activity.type, to)
      const cleared =
        to === 'resource'
          ? {
              start_date: undefined,
              end_date: null,
              start_time: null,
              end_time: null,
              day_of_week: null,
              duration_minutes: null,
              occurrences: [],
              repeat_rrule: null,
              repeat_frequency: null,
              repeat_next_date: null,
              tagline: null,
            }
          : {}
      setActivities((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, ...cleared, ...patch, type: to } : e
        )
      )
      return { ...cleared, ...patch, type: to }
    } catch (err) {
      console.error('Convert failed:', err)
      alert(
        `Couldn't convert to ${to}: ${err instanceof Error ? err.message : 'unknown error'}`
      )
      return null
    }
  }

  const handleDeleteActivity = async (
    id: string,
    type: 'event' | 'resource'
  ) => {
    setActivities((prev) => prev.filter((e) => e.id !== id))
    try {
      await deleteActivity(id, type)
    } catch (err) {
      console.error('Delete failed:', err)
      const activity = activities.find((e) => e.id === id)
      if (activity) setActivities((prev) => [...prev, activity])
    }
  }

  const handleRestoreEvent = async (id: string) => {
    const activity = activities.find((e) => e.id === id)
    if (!activity) return
    // Restoring out of 'done' sends it back to the inbox for a fresh look, and
    // clears the issue stamp so it doesn't still read as published.
    const restored = {
      ...activity,
      status: 'processed' as const,
      list_id: 'inbox' as ListId,
      in_next_issue: false,
      newsletter_last: null,
    }
    setActivities((prev) => prev.map((e) => (e.id === id ? restored : e)))
    try {
      await saveActivity(id, activity.type, restored)
    } catch (err) {
      console.error('Restore failed:', err)
      setActivities((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                status: activity.status,
                list_id: activity.list_id,
                newsletter_last: activity.newsletter_last,
              }
            : e
        )
      )
    }
  }

  // --- Location handlers -----------------------------------------------
  // Locations bypass the Activities triage tab entirely and have their own,
  // simpler lifecycle: Review -> Refine -> Gone. No 'services' array, no
  // expiry, and no archived state — a location is either accepted or deleted.
  const handleAddLocation = async (data: {
    name: string
    address: string
    area?: string | null
    neighborhood?: string | null
  }) => {
    try {
      const loc = await createLocation(data)
      setLocations((prev) =>
        [...prev, loc].sort((a, b) => a.name.localeCompare(b.name))
      )
    } catch (err) {
      console.error('createLocation failed:', err)
    }
  }

  const handleDecideLocationPost = async (id: string, inPost: boolean) => {
    const loc = locations.find((l) => l.id === id)
    if (!loc) return
    setLocations((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              list_id: (inPost ? 'refined' : 'done') as ListId,
              status: 'processed' as const,
              postpartum_post: inPost,
            }
          : l
      )
    )
    try {
      await decideLocationPost(id, inPost)
    } catch (err) {
      console.error('decideLocationPost failed:', err)
      setLocations((prev) => prev.map((l) => (l.id === id ? loc : l)))
    }
  }

  const handleDeleteLocation = async (id: string) => {
    const loc = locations.find((l) => l.id === id)
    setLocations((prev) => prev.filter((l) => l.id !== id))
    try {
      await deleteLocation(id)
    } catch (err) {
      console.error('deleteLocation failed:', err)
      if (loc) setLocations((prev) => [...prev, loc])
    }
  }

  const moveToError = async (
    id: string,
    type: 'event' | 'resource',
    description: string,
    seedCreated: boolean,
    reason?: string
  ) => {
    setActivities((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              list_id: 'inbox' as ListId,
              status: 'failed' as const,
              title: description,
              ...(reason ? { parse_error: reason } : {}),
            }
          : e
      )
    )
    if (seedCreated) {
      await saveActivity(id, type, {
        list_id: 'inbox',
        status: 'failed',
        title: description,
      } as Partial<DeskActivity>).catch(() => {})
    } else {
      await createActivity(id, type, {
        list_id: 'inbox',
        status: 'failed',
        description,
      }).catch(() => {})
    }
    if (reason) await flagParseError(id, type, reason).catch(() => {})
  }

  const handleAddEvent = async (captureData: CaptureDataProps) => {
    const description = captureData.description || ''
    const type = captureData.type ?? 'event'
    const preview_url = captureData.file
      ? URL.createObjectURL(captureData.file)
      : null
    const listId = captureData.list_id || 'inbox'
    // Every new activity defaults to both services (Newsletter + Post) — or
    // just Newsletter for resources, which are never eligible for Post (the
    // Postpartum Post matcher only queries events, locations, and
    // playgrounds). Matches the `services` column's DB default. This used to
    // only apply to items captured directly into Upcoming; ordinary
    // Capture/Review items got an explicit empty array here, which meant
    // every card silently started with no service and needed a human to
    // remember to turn one on before it could ever show up in
    // Newsletter/Post — that was the "lost events" bug.
    const seedServices: Service[] =
      type === 'event' ? ['newsletter', 'postpartum_post'] : ['newsletter']

    // Generate ID upfront so the storage path matches the DB record
    const id = crypto.randomUUID()

    if (captureData.use_ai) {
      const optimistic = createNewActivity(description, {
        id,
        type,
        list_id: listId,
        status: 'processing',
        services: seedServices,
        file: captureData.file,
        preview_url,
      })
      setActivities((prev) => [optimistic, ...prev])
      processingTimeouts.current.set(
        id,
        setTimeout(
          async () => {
            processingTimeouts.current.delete(id)
            await moveToError(
              id,
              type,
              description,
              true,
              'No response from the AI after 2 minutes'
            )
          },
          2 * 60 * 1000
        )
      )

      // Upload file to storage before creating the seed record
      let file_url: string | null = null
      if (captureData.file) {
        try {
          file_url = await uploadActivityFile(id, captureData.file)
          if (preview_url) URL.revokeObjectURL(preview_url)
          setActivities((prev) =>
            prev.map((e) =>
              e.id === id ? { ...e, file_url, preview_url: null } : e
            )
          )
        } catch (err) {
          console.error('File upload failed:', err)
          // Don't send an image-less capture to the AI as if nothing happened.
          // Park it in Errors with the reason so the image can be re-attached.
          disarmProcessingTimeout(id)
          await moveToError(
            id,
            type,
            description,
            false,
            `Image upload failed (${err instanceof Error ? err.message : 'unknown error'}) — re-attach the image and try again`
          )
          return
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

        const res = await fetch('/api/desk/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...postDeskData, id, action: 'add' }),
        })
        if (!res.ok) throw await webhookFailure(res)
      } catch (err) {
        disarmProcessingTimeout(id)
        console.error('Capture Error:', err)
        await moveToError(
          id,
          type,
          description,
          seedCreated,
          err instanceof Error ? err.message : 'Could not reach the AI'
        )
      }
    } else {
      const reviewed = createNewActivity(description, {
        id,
        type,
        title: description,
        list_id: 'inbox',
        status: 'new',
        services: seedServices,
        file: captureData.file,
        preview_url,
      })
      setActivities((prev) => [reviewed, ...prev])

      // Upload file to storage before creating the seed record
      let file_url: string | null = null
      if (captureData.file) {
        try {
          file_url = await uploadActivityFile(id, captureData.file)
          if (preview_url) URL.revokeObjectURL(preview_url)
          setActivities((prev) =>
            prev.map((e) =>
              e.id === id ? { ...e, file_url, preview_url: null } : e
            )
          )
        } catch (err) {
          console.error('File upload failed:', err)
        }
      }

      try {
        await createActivity(id, type, {
          description,
          list_id: 'inbox',
          status: 'new',
          services: seedServices,
          file_url,
        })
      } catch (err) {
        console.error('Capture Error:', err)
        await moveToError(id, type, description, false)
      }
    }
  }

  const handleSendToAI = async (activity: DeskActivity) => {
    setActivities((prev) =>
      prev.map((e) =>
        e.id === activity.id ? { ...e, status: 'processing' as const } : e
      )
    )
    processingTimeouts.current.set(
      activity.id,
      setTimeout(
        () => {
          processingTimeouts.current.delete(activity.id)
          setActivities((prev) =>
            prev.map((e) =>
              e.id === activity.id
                ? {
                    ...e,
                    status: 'new' as const,
                    list_id: 'error' as ListId,
                    parse_error: 'No response from the AI after 2 minutes',
                  }
                : e
            )
          )
        },
        2 * 60 * 1000
      )
    )
    try {
      await saveActivity(activity.id, activity.type, { status: 'processing' })
      const res = await fetch('/api/desk/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activity,
          id: activity.id,
          action: 'update',
          use_ai: true,
          file: null,
        }),
      })
      if (!res.ok) throw await webhookFailure(res)
    } catch (err) {
      disarmProcessingTimeout(activity.id)
      console.error('Send to AI Error:', err)
      const reason =
        err instanceof Error ? err.message : 'Could not reach the AI'
      setActivities((prev) =>
        prev.map((e) =>
          e.id === activity.id
            ? {
                ...e,
                status: 'new' as const,
                list_id: 'error' as ListId,
                parse_error: reason,
              }
            : e
        )
      )
      await flagParseError(activity.id, activity.type, reason).catch(() => {})
    }
  }

  const processingActivities = activities.filter(
    (a) => a.status === 'processing'
  )
  // Latest-value refs so the polling interval can read current data on each
  // tick without being torn down and recreated on every render.
  const processingRef = useRef(processingActivities)
  const moveToErrorRef = useRef(moveToError)
  useEffect(() => {
    processingRef.current = processingActivities
    moveToErrorRef.current = moveToError
  })
  const hasProcessing = processingActivities.length > 0
  useEffect(() => {
    if (!hasProcessing) return
    const intervalId = setInterval(async () => {
      const processingMeta = processingRef.current.map((a) => ({
        id: a.id,
        type: a.type,
        created_at: a.created_at,
      }))
      if (processingMeta.length === 0) return
      const processingIds = new Set(processingMeta.map((p) => p.id))
      const fetched = await pollForUpdates(processingMeta)
      setActivities((prev) => {
        const fetchedMap = new Map(fetched.map((a) => [a.id, a]))
        const existingIds = new Set(prev.map((a) => a.id))
        // pollForUpdates also does a broad "recent review items" catch-all so
        // it can discover new sibling records the AI split out of one
        // submission — but that same catch-all can return an item the user
        // has already moved elsewhere locally (e.g. approved out of Review)
        // whose save just hasn't landed in the DB yet. Only let this poll
        // overwrite an item we're actually watching (the processing set);
        // anything else it returns is either brand new or safe to leave alone.
        const updated = prev.map((a) =>
          processingIds.has(a.id) && fetchedMap.has(a.id)
            ? {
                ...fetchedMap.get(a.id)!,
                file: a.file,
                preview_url: a.preview_url,
              }
            : a
        )
        const newItems = fetched.filter((a) => !existingIds.has(a.id))
        return [...newItems, ...updated]
      })
      const now = Date.now()
      fetched.forEach((a) => {
        if (a.status !== 'processing') {
          disarmProcessingTimeout(a.id)
        } else if (
          // Measure from when processing started (status writes bump
          // updated_at), not from creation: re-sending an old card to the AI
          // would otherwise be flagged as stuck within seconds.
          now - new Date(a.updated_at || a.created_at).getTime() >
          5 * 60 * 1000
        ) {
          // Stuck for more than 5 minutes — move to error
          disarmProcessingTimeout(a.id)
          moveToErrorRef.current(
            a.id,
            a.type,
            a.title || '',
            true,
            'Still processing after 5 minutes'
          )
        }
      })
    }, 3000)
    return () => clearInterval(intervalId)
  }, [hasProcessing, disarmProcessingTimeout])

  // 'error' is folded into the Capture column as a collapsible section instead
  // of its own top-level column — stays in TRIAGE_LISTS (and ALL_LISTS) so
  // finishTarget/finishLabel lookups still work, just excluded from the map below.
  // Post has no ListProps entry — its three sections (Upcoming events,
  // Recurring Events, Match) are computed splits rendered as bespoke lists
  // further down, not through the generic Column component.
  // Locations tab groups
  const inboxLocations = locations.filter((l) => l.list_id === 'inbox')
  const goneLocations = locations.filter(
    (l) => l.list_id === 'refined' || l.list_id === 'done'
  )
  const inPostLocations = goneLocations.filter((l) => l.postpartum_post)
  const notInPostLocations = goneLocations.filter((l) => !l.postpartum_post)

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-base overflow-hidden">
      <header className="bg-base border-b border-slate-200 z-10">
        <div className="flex px-4 gap-4 items-center justify-between py-3">
          <div className="flex gap-2 overflow-x-auto">
            {(
              ['triage', 'newsletter', 'post', 'locations', 'done'] as Tab[]
            ).map((tab) => {
              const activeClass =
                tab === 'done'
                  ? 'border-green-400 bg-green-400 text-ink shadow-[0_0_20px_rgba(9,188,138,0.4)]'
                  : tab === 'locations'
                    ? 'border-violet-400 bg-violet-400 text-ink shadow-[0_0_20px_rgba(237,69,223,0.4)]'
                    : tab === 'post'
                      ? 'border-lamp-glow bg-lamp-glow text-ink shadow-[0_0_20px_rgba(227,45,212,0.45)]'
                      : tab === 'triage'
                        ? 'border-app-gold bg-app-gold text-ink shadow-[0_0_20px_rgba(255,191,0,0.4)]'
                        : 'border-blue-400 bg-blue-400 text-ink shadow-[0_0_20px_rgba(68,157,209,0.4)]'
              const label = tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl border-2 font-display text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === tab ? activeClass : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-white'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewsletterOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-display text-[10px] font-bold uppercase tracking-wider"
            >
              <Newspaper size={11} /> Next issue
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'done' ? (
        <DeskTable
          mode="done"
          rows={activities.filter(isDoneRow)}
          onOpen={openActivity}
          onRestore={handleRestoreEvent}
          onDelete={handleDeleteActivity}
          onArchive={handleArchiveEvent}
          onToggleService={handleToggleService}
        />
      ) : activeTab === 'locations' ? (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-x-auto bg-slate-100 gap-2 p-2">
          {/* Inbox */}
          <div className="w-full md:flex-1 md:basis-0 min-w-0">
            <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
              <div className="p-4 bg-violet-600 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">
                  Inbox
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-700 text-white">
                  {inboxLocations.length}
                </span>
              </div>
              <div className="p-3 space-y-3 bg-slate-100">
                <LocationForm
                  onAddLocation={handleAddLocation}
                  locations={locations}
                />
                {inboxLocations.length === 0 ? (
                  <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">
                    Nothing to see here 🌬️
                  </div>
                ) : (
                  inboxLocations.map((loc) => (
                    <LocationCard
                      key={loc.id}
                      location={loc}
                      onDetails={openLocation}
                      onDecide={handleDecideLocationPost}
                    />
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Settled: In Post / Not in Post */}
          <div className="w-full md:flex-1 md:basis-0 min-w-0">
            <section className="flex flex-col rounded-t-lg overflow-hidden flex-1">
              <div className="p-4 bg-green-600 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-white">
                  Settled
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-700 text-white">
                  {goneLocations.length}
                </span>
              </div>
              <div className="p-3 space-y-3 bg-slate-100">
                {goneLocations.length === 0 ? (
                  <div className="py-8 text-center text-[10px] tracking-wide text-slate-400 italic">
                    Nothing to see here 🌬️
                  </div>
                ) : (
                  (
                    [
                      { label: 'In Post', items: inPostLocations },
                      { label: 'Not in Post', items: notInPostLocations },
                    ] as const
                  ).map(({ label, items }) => {
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
                          {collapsed ? (
                            <ChevronRight size={11} />
                          ) : (
                            <ChevronDown size={11} />
                          )}
                          {label}
                          <span className="ml-auto bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">
                            {items.length}
                          </span>
                        </button>
                        {!collapsed && (
                          <div className="space-y-3">
                            {items.map((loc) => (
                              <LocationCard
                                key={loc.id}
                                location={loc}
                                onDetails={openLocation}
                              />
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
      ) : activeTab === 'triage' ? (
        <DeskTable
          rows={activities.filter(isHeld)}
          onOpen={openActivity}
          onAdd={handleAddEvent}
          onDoneRefining={handleDoneRefining}
          onArchive={handleArchiveEvent}
          onToggleService={handleToggleService}
        />
      ) : activeTab === 'newsletter' ? (
        <DeskTable
          mode="newsletter"
          issueDate={publishDate}
          rows={activities.filter(
            (e) =>
              e.services.includes('newsletter') &&
              e.list_id === 'refined' &&
              e.status !== 'archived' &&
              e.status !== 'published'
          )}
          onOpen={openActivity}
          onToggleNextIssue={handleToggleNextIssue}
          onArchive={handleArchiveEvent}
          onToggleService={handleToggleService}
        />
      ) : activeTab === 'post' ? (
        <DeskTable
          mode="post"
          rows={activities.filter(isPostEligible)}
          onOpen={openActivity}
          onArchive={handleArchiveEvent}
          onToggleService={handleToggleService}
        />
      ) : null}

      {newsletterOpen && (
        <NewsletterDrawer
          activities={activities}
          publishDate={publishDate}
          onPublishDateChange={handlePublishDateChange}
          onClose={() => setNewsletterOpen(false)}
          onFinishIssue={async () => {
            const next = activities.filter(
              (a) =>
                a.list_id === 'refined' &&
                a.in_next_issue &&
                a.status !== 'archived' &&
                a.status !== 'published' &&
                a.services.includes('newsletter')
            )
            const today = new Date().toISOString().split('T')[0]
            // Non-recurring Upcoming events that never made it into an issue and
            // whose date has already passed — drop 'newsletter' from services
            // (status untouched — they weren't rejected or published, just aged out).
            const staleUpcoming = activities.filter(
              (a) =>
                a.type === 'event' &&
                a.list_id === 'refined' &&
                !a.in_next_issue &&
                !a.repeat_rrule &&
                a.status !== 'archived' &&
                a.status !== 'published' &&
                (a.end_date
                  ? a.end_date < today
                  : !!a.start_date && a.start_date < today)
            )
            if (!next.length) return
            const eventIds = next
              .filter((a) => a.type === 'event')
              .map((a) => a.id)
            const resourceIds = next
              .filter((a) => a.type === 'resource')
              .map((a) => a.id)
            const d = new Date(publishDate)
            d.setUTCDate(d.getUTCDate() + 14)
            const newPublishDate = d.toISOString().split('T')[0]
            setActivities((prev) =>
              prev.map((a) => {
                if (next.some((n) => n.id === a.id)) {
                  const nextServices = a.services.filter(
                    (s) => s !== 'newsletter'
                  )
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
                    in_next_issue: false,
                    list_id: (becameEmpty ? 'done' : 'refined') as ListId,
                  }
                }
                if (staleUpcoming.some((s) => s.id === a.id)) {
                  const nextServices = a.services.filter(
                    (s) => s !== 'newsletter'
                  )
                  return {
                    ...a,
                    services: nextServices,
                    postpartum_post: nextServices.includes('postpartum_post'),
                    ...(nextServices.length === 0
                      ? { list_id: 'done' as ListId, in_next_issue: false }
                      : {}),
                  }
                }
                return a
              })
            )
            handlePublishDateChange(newPublishDate)
            setNewsletterOpen(false)
            await Promise.all([
              finishNewsletterIssue(eventIds, resourceIds, publishDate),
              sweepStaleUpcoming(staleUpcoming.map((a) => a.id)),
            ]).catch((err) =>
              console.error('Failed to finish newsletter issue:', err)
            )
          }}
        />
      )}

      {selectedActivity && (
        <ActivityDrawer
          activity={
            activities.find((e) => e.id === selectedActivity.id) ??
            selectedActivity
          }
          onSaveDraft={handleSaveDraft}
          onFinishEditing={handleFinishEditing}
          onClose={closeDrawer}
          onSendToAI={handleSendToAI}
          onDelete={handleDeleteActivity}
          onConvertType={handleConvertType}
          readOnly={selectedActivity.status === 'archived'}
          onRestore={() => handleRestoreEvent(selectedActivity.id)}
          locations={locations}
          onLocationSaved={(loc) =>
            setLocations((prev) => {
              const idx = prev.findIndex((l) => l.id === loc.id)
              return idx >= 0
                ? prev.map((l) => (l.id === loc.id ? loc : l))
                : [...prev, loc].sort((a, b) => a.name.localeCompare(b.name))
            })
          }
          onToggleService={(service, enabled) =>
            handleToggleService(selectedActivity.id, service, enabled)
          }
          onToggleNextIssue={handleToggleNextIssue}
        />
      )}

      {selectedLocation && (
        <LocationDrawer
          location={
            locations.find((l) => l.id === selectedLocation.id) ??
            selectedLocation
          }
          onClose={closeDrawer}
          onSaved={(loc) => {
            setLocations((prev) => prev.map((l) => (l.id === loc.id ? loc : l)))
            closeDrawer()
          }}
          onDelete={handleDeleteLocation}
        />
      )}
    </main>
  )
}
