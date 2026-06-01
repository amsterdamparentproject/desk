/**
 * Derives the next newsletter publish date from activity data.
 *
 * Rules:
 * - Only archived records are considered — cards staged in next_newsletter also
 *   carry newsletter_last (set when they were moved there) and must not inflate
 *   the result before the issue has actually been sent.
 * - The computed date is always in the future: if max(newsletter_last) + 14
 *   has already passed, keep advancing by 14-day increments until it isn't.
 * - If no newsletter has ever been sent, fall back to today + 7 days.
 */
export function computePublishDate(
  allRows: Array<{ status?: string; newsletter_last?: string | null }>,
  today: string,
): string {
  const dates = allRows
    .filter(r => r.status === 'archived')
    .map(r => r.newsletter_last)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)

  let next: string
  if (dates.length === 0) {
    // No newsletters sent yet — default to one week out
    const d = new Date(today)
    d.setDate(d.getDate() + 7)
    next = d.toISOString().split('T')[0]
  } else {
    const lastPublished = dates.reduce((max, d) => (d > max ? d : max))
    const d = new Date(lastPublished)
    d.setDate(d.getDate() + 14)
    next = d.toISOString().split('T')[0]
  }

  // Advance until future
  while (next <= today) {
    const d = new Date(next)
    d.setDate(d.getDate() + 14)
    next = d.toISOString().split('T')[0]
  }

  return next
}
