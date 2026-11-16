import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyDeskSession } from '@/app/utils/auth-gate'
import { createAdminClient } from '@/app/utils/supabase/server'

// Lets the share screen wait for the AI: reports whether a just-captured card
// is still processing. Same session cookie as the rest of the Desk.
export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyDeskSession(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createAdminClient()
  for (const table of ['events', 'resources'] as const) {
    const { data } = await supabase
      .from(table)
      .select('status, parse_error')
      .eq('id', id)
      .maybeSingle()
    if (data) {
      return NextResponse.json({
        status: data.status,
        failed: data.status === 'failed' || !!data.parse_error,
      })
    }
  }
  return NextResponse.json({ status: 'unknown', failed: false })
}
