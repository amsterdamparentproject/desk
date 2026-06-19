import { describe, it, expect } from 'vitest'
import { computePublishDate } from '../app/utils/publishDate'

const TODAY = '2026-06-03'

// Shorthand helpers
const published = (newsletter_last: string) => ({ status: 'published', newsletter_last })
const staged    = (newsletter_last: string) => ({ status: 'edited',    newsletter_last }) // in next_newsletter, not yet published

describe('computePublishDate', () => {
  it('returns today + 7 when no newsletters have ever been sent', () => {
    expect(computePublishDate([], TODAY)).toBe('2026-06-10')
  })

  it('returns today + 7 when all rows lack newsletter_last', () => {
    const rows = [
      { status: 'archived', newsletter_last: null },
      { status: 'edited',   newsletter_last: null },
    ]
    expect(computePublishDate(rows, TODAY)).toBe('2026-06-10')
  })

  it('computes last published newsletter_last + 14 days', () => {
    const rows = [published('2026-06-01')]
    expect(computePublishDate(rows, TODAY)).toBe('2026-06-15')
  })

  it('picks the max when multiple published records have different newsletter_last dates', () => {
    const rows = [
      published('2026-05-04'),
      published('2026-06-01'), // most recent
      published('2026-04-20'),
    ]
    expect(computePublishDate(rows, TODAY)).toBe('2026-06-15')
  })

  // Regression: this was the bug — staged cards in next_newsletter carry
  // newsletter_last equal to the current publishDate and must not be counted.
  it('ignores newsletter_last from non-published (next_newsletter) cards', () => {
    const rows = [
      published('2026-06-01'), // last sent issue
      staged('2026-06-15'),   // staged for upcoming issue — must NOT inflate result
      staged('2026-06-15'),
    ]
    expect(computePublishDate(rows, TODAY)).toBe('2026-06-15')
  })

  it('auto-advances by 14-day increments when the computed date is in the past', () => {
    // last sent was long ago — need multiple advances to reach the future
    const rows = [published('2026-03-01')] // +14 = Mar 15, +14 = Mar 29, … keep going until > Jun 3
    const result = computePublishDate(rows, TODAY)
    expect(result > TODAY).toBe(true)
    // Should land on a date that is exactly 14n days after 2026-03-01
    const base = new Date('2026-03-01')
    const got  = new Date(result)
    const diffDays = (got.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays % 14).toBe(0)
  })

  it('does not advance further than necessary — result is at most 13 days past today', () => {
    const rows = [published('2026-06-01')]
    const result = computePublishDate(rows, TODAY) // expect 2026-06-15
    const diffDays = (new Date(result).getTime() - new Date(TODAY).getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeLessThanOrEqual(14)
  })

  it('result is always strictly in the future', () => {
    const cases = [
      [published('2026-06-01')],
      [published('2025-01-01')],
      [],
    ]
    for (const rows of cases) {
      expect(computePublishDate(rows, TODAY) > TODAY).toBe(true)
    }
  })
})
