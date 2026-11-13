import { createHash } from 'crypto'

/**
 * Deterministic id for the Nth extra event the AI splits out of one capture
 * (a flyer listing several dates, say). The same parent + index always gives
 * the same UUID, so a retried n8n callback finds the card it already created
 * instead of creating a second copy.
 *
 * Formatted as a version-5-style UUID so it is valid for `uuid` columns.
 */
export function childActivityId(parentId: string, index: number): string {
  const bytes = createHash('sha1')
    .update(`desk-split:${parentId}:${index}`)
    .digest()
    .subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Buffer.from(bytes).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
