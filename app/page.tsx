// app/page.tsx
import { cookies } from 'next/headers';
import { DeskActivity } from '@/app/types/activity';
import Board from './components/Board';
import { verifyDeskToken } from './utils/auth-gate';
import { createAdminClient } from './utils/supabase/server';

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

  const [eventsResult, resourcesResult] = await Promise.all([
    supabase.from('events').select('*').order('created_at', { ascending: false }),
    supabase.from('resources').select('*').order('created_at', { ascending: false }),
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

  return (
    <Board initialActivities={activities as DeskActivity[]} />
  );
}
