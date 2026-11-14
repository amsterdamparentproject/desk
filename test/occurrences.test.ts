import { describe, it, expect } from 'vitest'
import {
  normalizeOccurrences,
  rangeFromOccurrences,
  occurrencesFromRange,
  nextOccurrence,
  formatOccurrenceDates,
  distinctDates,
  formatDayTimes,
} from '../lib/occurrences'

const o = (date: string, start_time: string | null = null) => ({
  date,
  start_time,
  end_time: null,
})

describe('normalizeOccurrences', () => {
  it('sorts, de-duplicates and drops invalid entries', () => {
    const r = normalizeOccurrences([
      { date: '2026-12-10', start_time: '14:00:00' },
      { date: '2026-12-03', start_time: '10:00' },
      { date: '2026-12-10', start_time: '15:00' },
      { date: 'nope' },
      null,
    ])
    expect(r).toEqual([
      { date: '2026-12-03', start_time: '10:00', end_time: null },
      { date: '2026-12-10', start_time: '15:00', end_time: null },
    ])
  })
  it('keeps several start times on one day, drops exact duplicates', () => {
    const r = normalizeOccurrences([
      { date: '2026-12-03', start_time: '14:00' },
      { date: '2026-12-03', start_time: '10:00', end_time: '11:00' },
      { date: '2026-12-03', start_time: '14:00', end_time: '15:00' },
    ])
    expect(r).toEqual([
      { date: '2026-12-03', start_time: '10:00', end_time: '11:00' },
      { date: '2026-12-03', start_time: '14:00', end_time: '15:00' },
    ])
  })
  it('returns an empty list for non-arrays', () => {
    expect(normalizeOccurrences(null)).toEqual([])
  })
})

describe('rangeFromOccurrences', () => {
  it('derives the single-range columns from the list', () => {
    expect(
      rangeFromOccurrences([o('2026-12-03', '10:00'), o('2026-12-17', '14:00')])
    ).toEqual({
      start_date: '2026-12-03',
      end_date: '2026-12-17',
      start_time: '10:00',
      end_time: null,
    })
  })
  it('leaves end_date empty for a single date', () => {
    expect(rangeFromOccurrences([o('2026-12-03')])?.end_date).toBeNull()
    expect(rangeFromOccurrences([])).toBeNull()
  })
})

describe('occurrencesFromRange', () => {
  it('gives every day of a legacy range the same times', () => {
    expect(
      occurrencesFromRange({
        start_date: '2026-12-01',
        end_date: '2026-12-03',
        start_time: '09:00:00',
        end_time: null,
      })
    ).toEqual([
      { date: '2026-12-01', start_time: '09:00', end_time: null },
      { date: '2026-12-02', start_time: '09:00', end_time: null },
      { date: '2026-12-03', start_time: '09:00', end_time: null },
    ])
  })
})

describe('nextOccurrence / formatOccurrenceDates', () => {
  const occ = [o('2026-11-28'), o('2026-12-03'), o('2026-12-10')]
  it('finds the first occurrence on or after a date', () => {
    expect(nextOccurrence(occ, '2026-12-03')?.date).toBe('2026-12-03')
    expect(nextOccurrence(occ, '2026-12-11')).toBeNull()
  })
  it('formats compactly, grouping by month', () => {
    expect(formatOccurrenceDates(occ)).toBe('28 Nov, 3 & 10 Dec')
    expect(formatOccurrenceDates([o('2026-12-03')])).toBe('3 Dec')
  })
})

describe('same-day sessions', () => {
  const occ = [
    { ...o('2026-12-03', '10:00'), end_time: '11:00' },
    o('2026-12-03', '14:00'),
    o('2026-12-10', '10:00'),
  ]
  it('lists each date once', () => {
    expect(distinctDates(occ)).toEqual(['2026-12-03', '2026-12-10'])
    expect(formatOccurrenceDates(occ)).toBe('3 & 10 Dec')
  })
  it("formats a day's times", () => {
    expect(formatDayTimes(occ.slice(0, 2))).toBe('10:00–11:00 & 14:00')
  })
  it('keeps a single end date for one-day events', () => {
    expect(rangeFromOccurrences(occ.slice(0, 2))?.end_date).toBeNull()
  })
})
