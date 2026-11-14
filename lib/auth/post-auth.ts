import { safeEqual } from './hmac'

/**
 * Authorises a request from Postpartum Post: a static bearer token
 * (POST_DESK_SECRET), the same pattern Post uses for its own server-to-server
 * routes. Compared in constant time.
 */
export function authorizePostRequest(
  headers: Pick<Headers, 'get'>
): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.POST_DESK_SECRET
  if (!secret)
    return { ok: false, reason: 'POST_DESK_SECRET is not configured' }
  return safeEqual(headers.get('authorization') ?? '', `Bearer ${secret}`)
    ? { ok: true }
    : { ok: false, reason: 'bad token' }
}
