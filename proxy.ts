import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'app_desk_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function proxy(request: NextRequest) {
  const tokenParam = request.nextUrl.searchParams.get('token')
  const secret = process.env.DESK_ACCESS_TOKEN

  if (!tokenParam || !secret || tokenParam !== secret) {
    return NextResponse.next()
  }

  // Valid token: strip it from the URL and set the auth cookie
  const cleanUrl = request.nextUrl.clone()
  cleanUrl.searchParams.delete('token')

  const response = NextResponse.redirect(cleanUrl)
  response.cookies.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
