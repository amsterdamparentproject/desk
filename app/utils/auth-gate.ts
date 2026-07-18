import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

export const COOKIE_NAME = 'app_desk_session'
// Login sessions are meant to rarely expire — effectively permanent until explicit logout.
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10 // 10 years

export function verifyDeskSession(cookieStore: ReadonlyRequestCookies): boolean {
  const secret = process.env.DESK_PASSWORD

  if (!secret) {
    console.error("⚠️ DESK_PASSWORD is not defined in env")
    return false
  }

  return cookieStore.get(COOKIE_NAME)?.value === secret
}
