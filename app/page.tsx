import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DeskActivity } from '@/app/types/activity'
import Board from './components/Board'
import { CaptureShell } from './components/CaptureShell'
import { verifyDeskSession } from './utils/auth-gate'
import { createAdminClient } from './utils/supabase/server'
import { getLocations } from './actions/activities'

function isCurrentEvent(event: any, today: string): boolean {
  const isRecurring = !!event.repeat_frequency
  if (isRecurring) {
    if (!event.end_date || event.end_date === event.start_date) return true
    return event.end_date >= today
  }
  if (event.end_date) return event.end_date >= today
  if (event.start_date) return event.start_date >= today
  return true
}

async function BoardWithData() {
  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  // Run cleanup in parallel with data fetch — previously these were sequential,
  // adding a full Supabase round-trip before the selects could start.
  const cleanupPromise = Promise.all([
    supabase.from('events').update({ list_id: 'error', status: 'new', updated_at: now })
      .eq('status', 'processing').lt('updated_at', staleThreshold),
    supabase.from('resources').update({ list_id: 'error', status: 'new', updated_at: now })
      .eq('status', 'processing').lt('updated_at', staleThreshold),
    supabase.from('events').update({ status: 'published', updated_at: now })
      .eq('list_id', 'next_newsletter').not('newsletter_last', 'is', null).lt('newsletter_last', today),
    supabase.from('resources').update({ status: 'published', updated_at: now })
      .eq('list_id', 'next_newsletter').not('newsletter_last', 'is', null).lt('newsletter_last', today),
  ])

  const [eventsResult, resourcesResult, locations] = await Promise.all([
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('resources').select('*').order('created_at', { ascending: false }),
    getLocations().catch(() => []),
  ])

  await cleanupPromise

  if (eventsResult.error || resourcesResult.error) {
    const message = eventsResult.error?.message ?? resourcesResult.error?.message
    console.error('Database Fetch Error:', message)
    return (
      <div className="p-6 text-sm bg-red-50 text-red-700 border border-red-200 rounded-xl">
        <span className="font-semibold">Database Schema Error:</span> {message}
      </div>
    )
  }

  // 'gone' items (aged-out or explicitly rejected) must always be fetched
  // regardless of date — 'gone' is the authoritative "exited the pipeline"
  // signal now, not just status === 'archived'. Aged-out items keep
  // status: 'accepted' (never forced to 'archived'), so without this they'd
  // silently vanish from the Archived tab the moment their date passed,
  // since isCurrentEvent() would otherwise exclude them.
  const TRIAGE_LIST_IDS = ['ideas', 'review', 'error', 'refine']
  const events = (eventsResult.data ?? [])
    .filter(e => e.status === 'archived' || e.status === 'published' || e.list_id === 'gone' || TRIAGE_LIST_IDS.includes(e.list_id) || isCurrentEvent(e, today))
    .map(e => ({ ...e, type: 'event' as const, file: null, preview_url: null }))

  const resources = (resourcesResult.data ?? [])
    .map(r => ({ ...r, type: 'resource' as const, file: null, preview_url: null }))

  const activities = [...events, ...resources]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <Board initialActivities={activities as DeskActivity[]} initialLocations={locations} />
  )
}

export default async function DeskPage() {
  const cookieStore = await cookies()
  const isAuthorized = verifyDeskSession(cookieStore)

  if (!isAuthorized) {
    redirect('/login')
  }

  return (
    <Suspense fallback={<CaptureShell />}>
      <BoardWithData />
    </Suspense>
  )
}
