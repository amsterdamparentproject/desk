import { NextRequest, NextResponse } from 'next/server'

// Desk's session cookie name (see app/utils/auth-gate.ts COOKIE_NAME). Inlined
// rather than imported so this edge middleware doesn't pull auth-gate's
// type-only Next internals.
const COOKIE_NAME = 'app_desk_session'

/**
 * Gate Server Actions behind the desk session (audit D1).
 *
 * Server Actions are POSTs that carry a `next-action` header. The pages that
 * host them already gate via verifyDeskSession + redirect, but the actions are
 * independently invocable POST endpoints — without this, the single-password
 * login only protects page *loads*, not the mutations (create/edit/delete/
 * archive newsletter content). API routes (no `next-action` header) manage
 * their own auth — verifyDeskSession or the n8n webhook secret — and are left
 * untouched here.
 */
export function middleware(req: NextRequest) {
  if (req.method !== 'POST' || !req.headers.has('next-action')) {
    return NextResponse.next()
  }

  const secret = process.env.DESK_PASSWORD
  if (!secret || req.cookies.get(COOKIE_NAME)?.value !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
