// app/page.tsx
import { cookies } from 'next/headers';
import { DeskActivity } from '@/app/types/activity';
import Board from './components/Board';
import { verifyDeskToken } from './utils/auth-gate';
import { createAdminClient } from './utils/supabase/server';

export default async function DeskPage() {
  const cookieStore = await cookies();
  const isAuthorized = verifyDeskToken(cookieStore);

  // 🔒 Gate 1: Check if the token is missing or incorrect
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

  // 🔑 Gate 2: Authorized! Boot up the admin client to bypass schema RLS barriers
  const supabase = createAdminClient();

  // Fetch events and resources in parallel
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

  const activities = [
    ...(eventsResult.data ?? []),
    ...(resourcesResult.data ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Pass the raw data array directly over the wire down to the client wrapper
  return (
      <Board initialActivities={(activities as DeskActivity[]) || []} />
  );
}