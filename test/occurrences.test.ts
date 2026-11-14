import { describe, it, expect } from 'vitest'
import {
  normalizeOccurrences,
  rangeFromOccurrences,
  occurrencesFromRange,
  nextOccurrence,
  formatOccurrenceDates,
  distinctDates,
  formatDayTimes,
  formatNewsletterDates,
} from '../lib/occurrences'

const o = (date: string, start_time: string | null = null) => ({
  date,
  start_time,
  end_time: null,
})

describe('normalizeOccurrences', () => {
  it('sorts and drops invalid entries', () => {
    const r = normalizeOccurrences([
      { date: '2026-12-10', start_time: '14:00:00' },
      { date: '2026-12-03', start_time: '10:00' },
      { date: '2026-12-10', start_time: '15:00' },
      { date: 'nope' },
      null,
    ])
    expect(r).toEqual([
      { date: '2026-12-03', start_time: '10:00', end_time: null },
      { date: '2026-12-10', start_time: '14:00', end_time: null },
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

describe('formatNewsletterDates', () => {
  const t = (date: string, start: string, end: string | null = null) => ({
    date,
    start_time: start,
    end_time: end,
  })
  it('collapses consecutive days with the same times into a range', () => {
    expect(
      formatNewsletterDates([
        t('2026-12-03', '10:00', '16:00'),
        t('2026-12-04', '10:00', '16:00'),
        t('2026-12-05', '10:00', '16:00'),
      ])
    ).toBe('3-5 Dec @ 10:00-16:00')
  })
  it('ranges across a month boundary', () => {
    expect(
      formatNewsletterDates([
        t('2026-11-30', '10:00'),
        t('2026-12-01', '10:00'),
      ])
    ).toBe('30 Nov-1 Dec @ 10:00')
  })
  it('shares one time across same-weekday dates', () => {
    expect(
      formatNewsletterDates([
        t('2026-12-05', '10:00'),
        t('2026-12-12', '10:00'),
        t('2026-12-19', '10:00'),
      ])
    ).toBe('Sat 5, 12 & 19 Dec @ 10:00')
  })
  it('names each weekday when they differ', () => {
    expect(
      formatNewsletterDates([
        t('2026-12-05', '10:00'),
        t('2026-12-09', '10:00'),
      ])
    ).toBe('Sat 5 Dec, Wed 9 Dec @ 10:00')
  })
  it('groups dates with different times separately', () => {
    expect(
      formatNewsletterDates([
        t('2026-12-05', '10:00'),
        t('2026-12-12', '10:00'),
        t('2026-12-13', '14:00'),
      ])
    ).toBe('Sat 5 & 12 Dec @ 10:00, Sun 13 Dec @ 14:00')
  })
  it('lists several sessions on one day', () => {
    expect(
      formatNewsletterDates([
        t('2026-12-05', '10:00', '11:00'),
        t('2026-12-05', '14:00'),
      ])
    ).toBe('Sat 5 Dec @ 10:00-11:00 & 14:00')
  })
  it('omits the time when there is none', () => {
    expect(
      formatNewsletterDates([
        { date: '2026-12-05', start_time: null, end_time: null },
        { date: '2026-12-06', start_time: null, end_time: null },
      ])
    ).toBe('5-6 Dec')
  })
})
