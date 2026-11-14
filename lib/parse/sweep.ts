/**
 * Rules for rescuing a card whose AI parse failed or never came back.
 * Shared by the failure callback and the stuck-card sweep so both put a card
 * in the same place.
 */

export type FailurePatch = { status: 'failed' }

/**
 * A failed or timed-out parse only changes the card's health: its stage
 * (list_id) is left alone, so a failure on an already-refined card never
 * yanks it back to Triage.
 */
export function failurePatch(): FailurePatch {
  return { status: 'failed' }
}

/** ISO timestamp before which a `processing` card counts as stuck. */
export function staleCutoffIso(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString()
}
