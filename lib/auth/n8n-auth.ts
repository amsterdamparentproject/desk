import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifySignature } from './hmac'

/**
 * Authorises a request coming from n8n (parse callback, scheduled calls) by
 * its timestamped HMAC signature (key: DESK_HMAC_KEY).
 *
 * `subject` is what n8n signed: the activity id for callbacks, the route
 * path for scheduled calls.
 */
export type N8nAuthResult = { ok: true } | { ok: false; reason: string }

export function authorizeN8nRequest(
  headers: Pick<Headers, 'get'>,
  subject: string | null,
  nowMs: number = Date.now()
): N8nAuthResult {
  const key = process.env.DESK_HMAC_KEY
  if (!key) return { ok: false, reason: 'DESK_HMAC_KEY is not configured' }
  if (!subject) {
    return { ok: false, reason: 'nothing to verify the signature against' }
  }

  const v = verifySignature({
    key,
    direction: 'n8n>desk',
    timestamp: headers.get(TIMESTAMP_HEADER),
    signature: headers.get(SIGNATURE_HEADER),
    subject,
    nowMs,
  })
  return v.ok ? { ok: true } : { ok: false, reason: v.reason }
}
