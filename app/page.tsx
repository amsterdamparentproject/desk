import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DeskActivity } from '@/app/types/activity'
import Board from './components/Board'
import { CaptureShell } from './components/CaptureShell'
import { verifyDeskSession } from './utils/auth-gate'
import { createAdminClient } from './utils/supabase/server'
import { getLocations } from './actions/activities'

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

  // Events are fetched unconditionally, regardless of date — same as
  // resources below, which have never had date-based gating. status/list_id
  // fully describe relevance in this pipeline model now; a past-dated,
  // non-recurring event sitting in 'upcoming_events' (status: 'accepted')
  // doesn't get moved to 'gone' until sweepStaleUpcoming runs (which only
  // happens when a newsletter issue is finished), so a date-based fetch gate
  // here repeatedly caused activities to silently vanish before ever
  // reaching the client — first for aged-out 'gone' items (fixed by adding a
  // 'gone' bypass), then again for any 'upcoming_events' item caught between
  // its date passing and the next sweep. Removing the gate entirely instead
  // of chasing more bypasses. Staleness/grouping by date is handled
  // client-side in Board.tsx (pastEvents, sweepStaleUpcoming, the Match
  // panel's month buckets) — the server fetch doesn't need its own parallel
  // notion of "current."
  const events = (eventsResult.data ?? [])
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
