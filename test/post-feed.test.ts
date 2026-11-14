import { describe, it, expect } from 'vitest'
import { expandEvent, weekdayOf, parseDays, freeOn } from '@/lib/post-feed'

const base = {
  start_date: '2026-12-01',
  end_date: null,
  start_time: '10:00',
  end_time: null,
  repeat_rrule: null,
  occurrences: [],
}

describe('expandEvent', () => {
  it('weekdayOf', () => expect(weekdayOf('2026-12-07')).toBe('Monday'))
  it('single event inside window', () => {
    expect(expandEvent(base, '2026-12-01', '2026-12-31', '2026-11-14')).toEqual(
      [{ date: '2026-12-01', start_time: '10:00', end_time: null }]
    )
  })
  it('excludes past and out-of-window', () => {
    expect(expandEvent(base, '2026-12-02', '2026-12-31', '2026-11-14')).toEqual(
      []
    )
    expect(expandEvent(base, '2026-12-01', '2026-12-31', '2026-12-05')).toEqual(
      []
    )
  })
  it('weekly BYDAY', () => {
    const r = expandEvent(
      {
        ...base,
        start_date: '2026-11-02',
        repeat_rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
      },
      '2026-12-01',
      '2026-12-14',
      '2026-11-14'
    )
    expect(r.map((s) => s.date)).toEqual([
      '2026-12-02',
      '2026-12-07',
      '2026-12-09',
      '2026-12-14',
    ])
  })
  it('biweekly keeps phase', () => {
    const r = expandEvent(
      {
        ...base,
        start_date: '2026-11-04',
        repeat_rrule: 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE',
      },
      '2026-11-15',
      '2026-12-31',
      '2026-11-14'
    )
    expect(r.map((s) => s.date)).toEqual([
      '2026-11-18',
      '2026-12-02',
      '2026-12-16',
      '2026-12-30',
    ])
  })
  it('monthly positional + until', () => {
    const rule = 'RRULE:FREQ=MONTHLY;BYDAY=1MO'
    expect(
      expandEvent(
        { ...base, start_date: '2026-01-05', repeat_rrule: rule },
        '2026-12-01',
        '2026-12-31',
        '2026-11-14'
      ).map((s) => s.date)
    ).toEqual(['2026-12-07'])
    expect(
      expandEvent(
        {
          ...base,
          start_date: '2026-01-05',
          repeat_rrule: rule + ';UNTIL=20261130',
        },
        '2026-12-01',
        '2026-12-31',
        '2026-11-14'
      )
    ).toEqual([])
  })
  it('specific dates keep own times', () => {
    const r = expandEvent(
      {
        ...base,
        occurrences: [
          { date: '2026-11-28', start_time: '09:00', end_time: null },
          { date: '2026-12-03', start_time: '14:00', end_time: '15:00' },
        ],
      },
      '2026-12-01',
      '2026-12-31',
      '2026-11-14'
    )
    expect(r).toEqual([
      { date: '2026-12-03', start_time: '14:00', end_time: '15:00' },
    ])
  })
})

describe('availability', () => {
  it('parses and defaults free', () => {
    expect(parseDays('monday, WEDNESDAY,bogus')).toEqual([
      'Monday',
      'Wednesday',
    ])
    expect(freeOn([], 'Monday')).toBe(true)
    expect(freeOn(['Tuesday'], 'Monday')).toBe(false)
  })
})
