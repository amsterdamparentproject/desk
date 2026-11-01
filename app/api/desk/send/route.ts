import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyDeskSession } from '@/app/utils/auth-gate'
import { postDesk } from '@/lib/PostToWebhook'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  if (!verifyDeskSession(cookieStore)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const result = await postDesk(body)
  // postDesk reports n8n failures in the body rather than throwing. Surface them
  // as a non-2xx so the client's `!res.ok` check actually fires (it used to see
  // a 200 and wait out the 2-minute processing timeout instead).
  return NextResponse.json(result, { status: result.success ? 200 : 502 })
}
