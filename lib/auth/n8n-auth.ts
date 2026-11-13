import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  safeEqual,
  verifySignature,
} from './hmac'

/**
 * Authorises a request coming from n8n (parse callback, scheduled calls).
 *
 * Preferred: timestamped HMAC signature (key: DESK_HMAC_KEY).
 * Transitional: the old shared-secret header (N8N_WEBHOOK_SECRET). It is
 * accepted unless ALLOW_LEGACY_N8N_SECRET=false — set that once n8n has
 * been switched over to signing.
 *
 * `subject` is what n8n signed: the activity id for callbacks, the route
 * path for scheduled calls.
 */
export type N8nAuthResult =
  { ok: true; method: 'hmac' | 'legacy' } | { ok: false; reason: string }

export function authorizeN8nRequest(
  headers: Pick<Headers, 'get'>,
  subject: string | null,
  nowMs: number = Date.now()
): N8nAuthResult {
  const key = process.env.DESK_HMAC_KEY
  const timestamp = headers.get(TIMESTAMP_HEADER)
  const signature = headers.get(SIGNATURE_HEADER)
  const legacyAllowed = process.env.ALLOW_LEGACY_N8N_SECRET !== 'false'

  let hmacFailure: string | null = null
  if (timestamp || signature) {
    if (!key) {
      hmacFailure = 'DESK_HMAC_KEY is not configured'
    } else if (!subject) {
      hmacFailure = 'nothing to verify the signature against'
    } else {
      const v = verifySignature({
        key,
        direction: 'n8n>desk',
        timestamp,
        signature,
        subject,
        nowMs,
      })
      if (v.ok) return { ok: true, method: 'hmac' }
      hmacFailure = v.reason
    }
  }

  if (legacyAllowed) {
    const legacy = process.env.N8N_WEBHOOK_SECRET
    const sent = headers.get('x-n8n-webhook-secret')
    if (legacy && sent && safeEqual(sent, legacy)) {
      if (hmacFailure) {
        console.warn(
          `n8n auth: signature rejected (${hmacFailure}); accepted legacy secret`
        )
      }
      return { ok: true, method: 'legacy' }
    }
  }

  return { ok: false, reason: hmacFailure ?? 'unauthorized' }
}
