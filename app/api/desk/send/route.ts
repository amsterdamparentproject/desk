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
  return NextResponse.json(result)
}
