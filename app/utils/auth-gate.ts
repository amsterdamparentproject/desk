import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

const COOKIE_NAME = 'app_desk_token'

export function verifyDeskToken(cookieStore: ReadonlyRequestCookies): boolean {
  const secret = process.env.DESK_ACCESS_TOKEN

  if (!secret) {
    console.error("⚠️ DESK_ACCESS_TOKEN is not defined in env")
    return false
  }

  return cookieStore.get(COOKIE_NAME)?.value === secret
}