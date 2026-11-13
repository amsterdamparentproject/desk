import { describe, it, expect, afterEach } from 'vitest'
import {
  computeSignature,
  safeEqual,
  signedHeaders,
  verifySignature,
} from '../lib/auth/hmac'
import { authorizeN8nRequest } from '../lib/auth/n8n-auth'

const key = 'test-key'
const now = 1_800_000_000_000
const headersOf = (o: Record<string, string>) => ({
  get: (n: string) => o[n.toLowerCase()] ?? null,
})

describe('verifySignature', () => {
  const h = signedHeaders(key, 'n8n>desk', 'abc', now)
  const check = (over: Partial<Parameters<typeof verifySignature>[0]> = {}) =>
    verifySignature({
      key,
      direction: 'n8n>desk',
      timestamp: h['x-desk-timestamp'],
      signature: h['x-desk-signature'],
      subject: 'abc',
      nowMs: now,
      ...over,
    })

  it('accepts a fresh, correct signature', () => {
    expect(check({ nowMs: now + 1000 })).toEqual({ ok: true })
  })

  it('rejects wrong subject, direction or key', () => {
    expect(check({ subject: 'other' })).toMatchObject({ ok: false })
    expect(check({ direction: 'desk>n8n' })).toMatchObject({ ok: false })
    expect(check({ key: 'wrong' })).toMatchObject({ ok: false })
  })

  it('rejects expired, future-dated and malformed requests', () => {
    expect(check({ nowMs: now + 301_000 })).toEqual({
      ok: false,
      reason: 'signature expired',
    })
    expect(check({ nowMs: now - 61_000 })).toEqual({
      ok: false,
      reason: 'timestamp in future',
    })
    expect(check({ timestamp: 'abc' })).toEqual({
      ok: false,
      reason: 'bad timestamp',
    })
    expect(check({ signature: null })).toEqual({
      ok: false,
      reason: 'missing signature',
    })
  })

  it("matches an independently computed HMAC (what n8n's Crypto node produces)", () => {
    // openssl: printf 'n8n>desk.1.x' | openssl dgst -sha256 -hmac k
    expect(computeSignature('k', 'n8n>desk', '1', 'x')).toBe(
      'c724f8613c49390b4897ed40d43385c2af5d406bb6587eff696754041c17ed3b'
    )
  })
})

describe('safeEqual', () => {
  it('compares strings, never equal for empty or different lengths', () => {
    expect(safeEqual('a', 'a')).toBe(true)
    expect(safeEqual('a', 'b')).toBe(false)
    expect(safeEqual('a', 'ab')).toBe(false)
    expect(safeEqual('', '')).toBe(false)
  })
})

describe('authorizeN8nRequest', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })
  const signed = signedHeaders(key, 'n8n>desk', 'abc', now)

  it('accepts a valid signature', () => {
    process.env.DESK_HMAC_KEY = key
    expect(authorizeN8nRequest(headersOf(signed), 'abc', now)).toEqual({
      ok: true,
    })
  })

  it('rejects the old shared-secret header', () => {
    process.env.DESK_HMAC_KEY = key
    const legacy = headersOf({ 'x-n8n-webhook-secret': 'legacy' })
    expect(authorizeN8nRequest(legacy, 'abc', now).ok).toBe(false)
  })

  it('rejects a bad signature even when the old header is sent too', () => {
    process.env.DESK_HMAC_KEY = key
    const both = headersOf({ ...signed, 'x-n8n-webhook-secret': 'legacy' })
    expect(authorizeN8nRequest(both, 'WRONG', now).ok).toBe(false)
    expect(authorizeN8nRequest(both, 'abc', now).ok).toBe(true)
  })

  it('rejects everything when nothing is configured or sent', () => {
    delete process.env.DESK_HMAC_KEY
    expect(authorizeN8nRequest(headersOf({}), 'abc', now).ok).toBe(false)
    expect(authorizeN8nRequest(headersOf(signed), 'abc', now).ok).toBe(false)
  })
})
