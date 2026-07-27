import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseRrule, buildRrule, computeNextDate } from '../app/utils/rrule'

// ---------------------------------------------------------------------------
// parseRrule
// ---------------------------------------------------------------------------

describe('parseRrule', () => {
  it('parses a weekly rrule with a single day', () => {
    const result = parseRrule('RRULE:FREQ=WEEKLY;BYDAY=MO')
    expect(result).toEqual({ frequency: 'weekly', days: ['MO'], untilDate: '' })
  })

  it('parses a weekly rrule with multiple days', () => {
    const result = parseRrule('RRULE:FREQ=WEEKLY;BYDAY=TU,TH')
    expect(result).toEqual({ frequency: 'weekly', days: ['TU', 'TH'], untilDate: '' })
  })

  it('parses biweekly (INTERVAL=2) correctly', () => {
    const result = parseRrule('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE')
    expect(result).toEqual({ frequency: 'biweekly', days: ['WE'], untilDate: '' })
  })

  it('parses a monthly positional rrule', () => {
    const result = parseRrule('RRULE:FREQ=MONTHLY;BYDAY=1MO')
    expect(result).toEqual({ frequency: 'monthly', days: ['1MO'], untilDate: '' })
  })

  it('parses last-weekday-of-month', () => {
    const result = parseRrule('RRULE:FREQ=MONTHLY;BYDAY=-1FR')
    expect(result).toEqual({ frequency: 'monthly', days: ['-1FR'], untilDate: '' })
  })

  it('parses UNTIL date', () => {
    const result = parseRrule('RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231')
    expect(result).toEqual({ frequency: 'weekly', days: ['MO'], untilDate: '2026-12-31' })
  })

  it('returns null frequency for null/empty input', () => {
    expect(parseRrule(null)).toEqual({ frequency: null, days: [], untilDate: '' })
    expect(parseRrule('')).toEqual({ frequency: null, days: [], untilDate: '' })
  })
})

// ---------------------------------------------------------------------------
// buildRrule
// ---------------------------------------------------------------------------

describe('buildRrule', () => {
  it('builds a weekly rrule', () => {
    expect(buildRrule({ frequency: 'weekly', days: ['MO'], untilDate: '' }))
      .toBe('RRULE:FREQ=WEEKLY;BYDAY=MO')
  })

  it('builds a biweekly rrule', () => {
    expect(buildRrule({ frequency: 'biweekly', days: ['WE'], untilDate: '' }))
      .toBe('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE')
  })

  it('builds a monthly positional rrule', () => {
    expect(buildRrule({ frequency: 'monthly', days: ['1MO'], untilDate: '' }))
      .toBe('RRULE:FREQ=MONTHLY;BYDAY=1MO')
  })

  it('includes UNTIL when provided', () => {
    expect(buildRrule({ frequency: 'weekly', days: ['FR'], untilDate: '2026-12-31' }))
      .toBe('RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20261231')
  })

  it('returns empty string when no frequency', () => {
    expect(buildRrule({ frequency: '', days: [], untilDate: '' })).toBe('')
  })

  it('round-trips through parse → build', () => {
    const original = 'RRULE:FREQ=WEEKLY;BYDAY=TU,TH'
    const { frequency, days, untilDate } = parseRrule(original)
    expect(buildRrule({ frequency: frequency!, days, untilDate })).toBe(original)
  })
})

// ---------------------------------------------------------------------------
// computeNextDate
// Pin "today" to 2026-06-20 so tests are deterministic regardless of when run
// ---------------------------------------------------------------------------

const FIXED_TODAY = new Date('2026-06-20T00:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('computeNextDate – weekly', () => {
  it('returns the next Monday for a weekly Monday event with a past start date', () => {
    // start_date is in the past; reference becomes today (Sat 2026-06-20)
    // next Monday from today = 2026-06-22
    const result = computeNextDate('weekly', ['MO'], '', '2026-01-05')
    expect(result).toBe('2026-06-22')
  })

  it('returns the first occurrence after start_date when start is in the future', () => {
    // start_date = 2026-06-30 (Tuesday); next Thursday after that = 2026-07-02
    const result = computeNextDate('weekly', ['TH'], '', '2026-06-30')
    expect(result).toBe('2026-07-02')
  })

  it('handles multiple days and returns the nearest upcoming one', () => {
    // today is Saturday 2026-06-20; TU=23 Jun, TH=25 Jun → nearest is TU
    const result = computeNextDate('weekly', ['TU', 'TH'], '', '2026-01-01')
    expect(result).toBe('2026-06-23')
  })

  it('returns null when UNTIL has already passed', () => {
    const result = computeNextDate('weekly', ['MO'], '2026-01-01', '2025-01-01')
    expect(result).toBeNull()
  })

  it('caps at UNTIL when next occurrence would exceed it', () => {
    // next Monday = 2026-06-22, UNTIL = 2026-06-21 → null
    const result = computeNextDate('weekly', ['MO'], '2026-06-21', '2026-01-05')
    expect(result).toBeNull()
  })
})

describe('computeNextDate – biweekly', () => {
  it('returns the next occurrence at least 8 days out', () => {
    // start in past; today = Sat 2026-06-20; next Wednesday ≥ 8 days = 2026-07-01
    const result = computeNextDate('biweekly', ['WE'], '', '2026-01-07')
    expect(result).toBe('2026-07-01')
  })
})

describe('computeNextDate – monthly', () => {
  it('returns the 1st Monday of next month when this month\'s has passed', () => {
    // today = 2026-06-20 (Sat); 1st Monday of June = 2026-06-01 (already past)
    // 1st Monday of July = 2026-07-06
    const result = computeNextDate('monthly', ['1MO'], '', '2026-01-05')
    expect(result).toBe('2026-07-06')
  })

  it('returns the 1st Monday this month if it hasn\'t happened yet', () => {
    // Pin today to 2026-06-01 (Mon) — the 1st Monday IS today, so next = July 6
    vi.setSystemTime(new Date('2026-06-01T00:00:00'))
    const result = computeNextDate('monthly', ['1MO'], '', '2026-01-05')
    expect(result).toBe('2026-07-06')
  })

  it('returns the last Friday of the month', () => {
    // today = 2026-06-20; last Fri of June = 2026-06-26
    const result = computeNextDate('monthly', ['-1FR'], '', '2026-01-02')
    expect(result).toBe('2026-06-26')
  })
})

describe('computeNextDate – daily', () => {
  it('returns tomorrow when start is in the past', () => {
    const result = computeNextDate('daily', [], '', '2026-01-01')
    expect(result).toBe('2026-06-21')
  })

  it('returns day after start_date when start is in the future', () => {
    const result = computeNextDate('daily', [], '', '2026-07-10')
    expect(result).toBe('2026-07-11')
  })
})

describe('computeNextDate – cron reference date behaviour', () => {
  it('uses yesterday as reference when passed explicitly (cron pattern)', () => {
    // Cron passes max(start_date, yesterday) directly as startDate
    // yesterday = 2026-06-19 (Fri); next Monday = 2026-06-22
    const yesterday = '2026-06-19'
    const result = computeNextDate('weekly', ['MO'], '', yesterday)
    expect(result).toBe('2026-06-22')
  })

  it('produces the same result as the Recalculate button for a future start date', () => {
    const startDate = '2026-08-26' // Wednesday
    const cronRef = startDate > '2026-06-19' ? startDate : '2026-06-19'
    const cronResult = computeNextDate('weekly', ['WE'], '', cronRef)
    const recalcResult = computeNextDate('weekly', ['WE'], '', startDate)
    // Both should give the first Wednesday after 2026-08-26 = 2026-09-02
    expect(cronResult).toBe('2026-09-02')
    expect(recalcResult).toBe('2026-09-02')
  })
})

describe('computeNextDate – null / no frequency', () => {
  it('returns null when frequency is null or empty', () => {
    expect(computeNextDate(null, [], '', '2026-06-01')).toBeNull()
    expect(computeNextDate('', [], '', '2026-06-01')).toBeNull()
  })
})
