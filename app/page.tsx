// app/page.tsx
import { cookies } from 'next/headers';
import { DeskActivity } from '@/app/types/activity';
import Board from './components/Board';
import { verifyDeskToken } from './utils/auth-gate';
import { createAdminClient } from './utils/supabase/server';
import { getLocations } from './actions/activities';

function computePublishDate(allRows: any[], today: string): string {
  const dates = allRows
    .map(r => r.newsletter_last)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)

  // If no newsletters have ever been sent, default to today + 7 days
  let next: string
  if (dates.length === 0) {
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    next = d.toISOString().split('T')[0]
  } else {
    const lastPublished = dates.reduce((max, d) => (d > max ? d : max))
    const d = new Date(lastPublished)
    d.setDate(d.getDate() + 14)
    next = d.toISOString().split('T')[0]
  }

  // Auto-advance by 14-day increments until the date is in the future
  while (next <= today) {
    const d = new Date(next)
    d.setDate(d.getDate() + 14)
    next = d.toISOString().split('T')[0]
  }

  return next
}

function isCurrentEvent(event: any, today: string): boolean {
  const isRecurring = !!event.repeat_frequency
  if (isRecurring) {
    // Open-ended recurring: end_date absent or same as start (first-occurrence placeholder)
    if (!event.end_date || event.end_date === event.start_date) return true
    return event.end_date >= today
  }
  if (event.end_date) return event.end_date >= today
  if (event.start_date) return event.start_date >= today
  return true
}

export default async function DeskPage() {
  const cookieStore = await cookies();
  const isAuthorized = verifyDeskToken(cookieStore);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 text-amber-600 mb-4">
            🔒
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Desk Workspace Locked</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
            This workspace requires a valid device token parameter to access backend records.
          </p>
        </div>
      </div>
    );
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date().toISOString();

  // Resolve any processing records that have been stuck for more than 5 minutes
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  // Auto-archive next_newsletter cards whose issue date has passed
  await Promise.all([
    supabase.from('events').update({ list_id: 'error', status: 'new', updated_at: now })
      .eq('status', 'processing').lt('updated_at', staleThreshold),
    supabase.from('resources').update({ list_id: 'error', status: 'new', updated_at: now })
      .eq('status', 'processing').lt('updated_at', staleThreshold),
    supabase.from('events').update({ status: 'archived', updated_at: now })
      .eq('list_id', 'next_newsletter').not('newsletter_last', 'is', null).lt('newsletter_last', today),
    supabase.from('resources').update({ status: 'archived', updated_at: now })
      .eq('list_id', 'next_newsletter').not('newsletter_last', 'is', null).lt('newsletter_last', today),
  ]);

  const [eventsResult, resourcesResult, locations] = await Promise.all([
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('resources').select('*').order('created_at', { ascending: false }),
    getLocations().catch(() => []),
  ]);

  if (eventsResult.error || resourcesResult.error) {
    const message = eventsResult.error?.message ?? resourcesResult.error?.message;
    console.error('Database Fetch Error:', message);
    return (
      <div className="p-6 text-sm bg-red-50 text-red-700 border border-red-200 rounded-xl">
        <span className="font-semibold">Database Schema Error:</span> {message}
      </div>
    );
  }

  const events = (eventsResult.data ?? [])
    .filter(e => e.status === 'archived' || isCurrentEvent(e, today))
    .map(e => ({ ...e, type: 'event' as const, file: null, preview_url: null }))

  const resources = (resourcesResult.data ?? [])
    .map(r => ({ ...r, type: 'resource' as const, file: null, preview_url: null }))

  const activities = [...events, ...resources]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const publishDate = computePublishDate(
    [...(eventsResult.data ?? []), ...(resourcesResult.data ?? [])],
    today,
  )

  return (
    <Board initialActivities={activities as DeskActivity[]} initialLocations={locations} initialPublishDate={publishDate} />
  );
}
