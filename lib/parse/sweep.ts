/**
 * Rules for rescuing a card whose AI parse failed or never came back.
 * Shared by the failure callback and the stuck-card sweep so both put a card
 * in the same place.
 */

// Lists a card is still "fresh" in. A failed parse here moves the card to the
// Error list. (Mirrors TRIAGE_STAGE_LISTS in app/actions/activities.ts.)
const TRIAGE_LISTS = new Set(['ideas', 'capture', 'review', 'error'])

export type FailurePatch = {
  list_id?: 'error'
  status?: 'new' | 'processed' | 'accepted'
}

/**
 * Where a card should land after a failed or timed-out parse.
 * - Still in triage: move to Error and reset to `new`, matching what the
 *   browser-side timeout already does.
 * - Already promoted (someone hit "Send to AI" on a Refine/Upcoming card):
 *   leave it where it is and just clear the stuck `processing` status, so the
 *   failure never yanks a triaged card back to Triage.
 */
export function failurePatch(listId: string | null | undefined): FailurePatch {
  if (!listId || TRIAGE_LISTS.has(listId)) {
    return { list_id: 'error', status: 'new' }
  }
  if (listId === 'refine') return { status: 'processed' }
  if (listId === 'gone') return {}
  return { status: 'accepted' }
}

/** ISO timestamp before which a `processing` card counts as stuck. */
export function staleCutoffIso(now: Date, minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString()
}
