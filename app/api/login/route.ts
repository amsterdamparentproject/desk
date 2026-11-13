import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, COOKIE_MAX_AGE } from '@/app/utils/auth-gate'
import { safeEqual } from '@/lib/auth/hmac'

// Sign-in is a plain form POST to a route handler, not a Server Action:
// proxy.ts rejects every request carrying a `next-action` header unless the
// session cookie is already valid, so a login *action* could never succeed
// for someone who isn't signed in yet. This route has no such header and
// does its own check.
export async function POST(request: NextRequest) {
  const secret = process.env.DESK_PASSWORD
  const form = await request.formData().catch(() => null)
  const password = String(form?.get('password') ?? '')

  if (!secret || !safeEqual(password, secret)) {
    return NextResponse.redirect(new URL('/login?error=1', request.url), 303)
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303)
  response.cookies.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return response
}
