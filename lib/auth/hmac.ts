import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Request signing between Desk and n8n.
 *
 * Instead of sending a shared secret in a header (where it ends up in n8n
 * execution history and pinned test data), the sender sends a timestamp and
 * an HMAC-SHA256 signature. The key itself never travels.
 *
 *   message   = `${direction}.${timestamp}.${subject}`
 *   signature = hex(HMAC_SHA256(key, message))
 *
 * - direction  "desk>n8n" or "n8n>desk": a signature captured going one way
 *              can't be replayed the other way, even though both use one key.
 * - timestamp  unix seconds; requests outside a 5-minute window are rejected,
 *              so a leaked signature expires.
 * - subject    what the request is about: the activity id for parse
 *              requests/callbacks, the route path for scheduled calls.
 */

export type Direction = 'desk>n8n' | 'n8n>desk'

export const TIMESTAMP_HEADER = 'x-desk-timestamp'
export const SIGNATURE_HEADER = 'x-desk-signature'
export const MAX_AGE_SECONDS = 300
// Tolerate small clock differences between Netlify and n8n.
const MAX_FUTURE_SECONDS = 60

export function computeSignature(
  key: string,
  direction: Direction,
  timestamp: string,
  subject: string
): string {
  return createHmac('sha256', key)
    .update(`${direction}.${timestamp}.${subject}`)
    .digest('hex')
}

export function signedHeaders(
  key: string,
  direction: Direction,
  subject: string,
  nowMs: number = Date.now()
): Record<string, string> {
  const timestamp = String(Math.floor(nowMs / 1000))
  return {
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: computeSignature(key, direction, timestamp, subject),
  }
}

/** Constant-time string comparison (false for different lengths). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb)
}

export type Verification = { ok: true } | { ok: false; reason: string }

export function verifySignature(args: {
  key: string
  direction: Direction
  timestamp: string | null | undefined
  signature: string | null | undefined
  subject: string
  nowMs?: number
}): Verification {
  const { key, direction, timestamp, signature, subject } = args
  const nowSeconds = (args.nowMs ?? Date.now()) / 1000

  if (!timestamp || !signature)
    return { ok: false, reason: 'missing signature' }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad timestamp' }
  const age = nowSeconds - ts
  if (age > MAX_AGE_SECONDS) return { ok: false, reason: 'signature expired' }
  if (age < -MAX_FUTURE_SECONDS)
    return { ok: false, reason: 'timestamp in future' }

  const expected = computeSignature(key, direction, timestamp, subject)
  return safeEqual(signature.toLowerCase(), expected)
    ? { ok: true }
    : { ok: false, reason: 'signature mismatch' }
}
