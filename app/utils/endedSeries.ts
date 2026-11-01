// What the recurrence refresh should write for a recurring event whose series
// has ended (UNTIL passed, so there is no next occurrence).
//
// Mirrors sweepStaleUpcoming (app/actions/activities.ts): an aged-out event is
// NOT archived — status is left alone ('archived' means explicitly rejected,
// 'published' means it went out in an issue). 'newsletter' is dropped from
// services, and list_id only moves to 'gone' once no services remain.
// Untriaged events (new/processing/processed) just get repeat_next_date cleared;
// they still need a human decision.
//
// Returns the columns to update, or null when the row is already settled so the
// cron can skip it instead of rewriting null -> null on every run.

export interface EndedSeriesEvent {
  status: string
  list_id: string
  services: string[] | null
  repeat_next_date: string | null
}

export function endedSeriesPatch(
  event: EndedSeriesEvent
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {}

  if (event.repeat_next_date != null) patch.repeat_next_date = null

  const triaged = event.status === 'accepted' || event.status === 'published'
  if (triaged) {
    const current = event.services ?? []
    const next = current.filter((s) => s !== 'newsletter')
    if (next.length !== current.length) {
      patch.services = next
      patch.postpartum_post = next.includes('postpartum_post')
    }
    if (next.length === 0 && event.list_id !== 'gone') patch.list_id = 'gone'
  }

  return Object.keys(patch).length > 0 ? patch : null
}
