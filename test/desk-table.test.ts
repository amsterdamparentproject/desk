import { describe, it, expect } from 'vitest'
import type { DeskActivity } from '../app/types/activity'
import {
  filterRows,
  isHeld,
  isPastEvent,
  isPostEligible,
  postGroup,
  doneGroup,
  isDoneRow,
  needsAttention,
  effectiveStart,
  sortRows,
} from '../lib/desk-table'

const row = (o: Partial<DeskActivity>): DeskActivity =>
  ({
    id: 'x',
    title: 'T',
    type: 'event',
    list_id: 'inbox',
    status: 'processed',
    services: ['newsletter', 'postpartum_post'],
    created_at: '2026-11-01T10:00:00Z',
    ...o,
  }) as DeskActivity

describe('sortRows', () => {
  const a = row({
    id: 'a',
    title: 'beta',
    start_date: '2026-12-05',
    created_at: '2026-11-01T00:00:00Z',
  })
  const b = row({
    id: 'b',
    title: 'Alpha',
    start_date: '2026-11-20',
    created_at: '2026-11-03T00:00:00Z',
  })
  const r = row({
    id: 'r',
    title: 'Guide',
    type: 'resource',
    start_date: undefined,
    created_at: '2026-11-02T00:00:00Z',
  })

  it('sorts by created, newest first', () => {
    expect(sortRows([a, b, r], 'created', 'desc').map((x) => x.id)).toEqual([
      'b',
      'r',
      'a',
    ])
  })
  it('sorts by start date with resources always last', () => {
    expect(sortRows([r, a, b], 'start', 'asc').map((x) => x.id)).toEqual([
      'b',
      'a',
      'r',
    ])
    expect(sortRows([r, a, b], 'start', 'desc').map((x) => x.id)).toEqual([
      'a',
      'b',
      'r',
    ])
  })
  it('sorts alphabetically, ignoring case', () => {
    expect(sortRows([a, b, r], 'title', 'asc').map((x) => x.id)).toEqual([
      'b',
      'a',
      'r',
    ])
  })
  it('uses the next occurrence for recurring events', () => {
    const rec = row({
      id: 'rec',
      start_date: '2026-01-01',
      repeat_next_date: '2026-11-18T00:00:00Z',
    })
    expect(sortRows([a, b, rec], 'start', 'asc').map((x) => x.id)).toEqual([
      'rec',
      'b',
      'a',
    ])
  })
})

describe('isPastEvent', () => {
  it('flags finished one-off events only', () => {
    expect(isPastEvent(row({ start_date: '2026-11-01' }), '2026-11-13')).toBe(
      true
    )
    expect(
      isPastEvent(
        row({ start_date: '2026-11-01', end_date: '2026-11-20' }),
        '2026-11-13'
      )
    ).toBe(false)
    expect(
      isPastEvent(
        row({ start_date: '2026-01-01', repeat_rrule: 'FREQ=WEEKLY' }),
        '2026-11-13'
      )
    ).toBe(false)
    expect(
      isPastEvent(
        row({ type: 'resource', start_date: '2026-01-01' }),
        '2026-11-13'
      )
    ).toBe(false)
  })
})

describe('filterRows / isHeld', () => {
  it('filters by type, text and problems', () => {
    const e = row({ id: 'e', title: 'Baby massage', organization: 'OBA' })
    const x = row({
      id: 'x',
      type: 'resource',
      title: 'Guide',
      status: 'failed',
      parse_error: 'boom',
    })
    const none = { type: 'all', query: '', onlyProblems: false } as const
    expect(
      filterRows([e, x], { ...none, type: 'resource' }).map((r) => r.id)
    ).toEqual(['x'])
    expect(
      filterRows([e, x], { ...none, query: 'oba' }).map((r) => r.id)
    ).toEqual(['e'])
    expect(
      filterRows([e, x], { ...none, onlyProblems: true }).map((r) => r.id)
    ).toEqual(['x'])
  })
  it('holds the inbox but not refined or done', () => {
    expect(isHeld(row({ list_id: 'inbox' }))).toBe(true)
    expect(isHeld(row({ list_id: 'refined' }))).toBe(false)
    expect(isHeld(row({ list_id: 'inbox', status: 'archived' }))).toBe(false)
  })
})

describe('postGroup', () => {
  const end = '2026-11-30'
  it('puts recurring events in recurring, regardless of date', () => {
    expect(
      postGroup(
        {
          repeat_rrule: 'FREQ=WEEKLY',
          repeat_next_date: '2027-01-01',
          start_date: null,
        },
        end
      )
    ).toBe('recurring')
  })
  it('splits single events by month end, overdue and undated included', () => {
    const g = (d: string | null) =>
      postGroup(
        { repeat_rrule: null, repeat_next_date: null, start_date: d },
        end
      )
    expect(g('2026-11-30')).toBe('this')
    expect(g('2026-10-01')).toBe('this')
    expect(g('2026-12-01')).toBe('future')
    expect(g(null)).toBe('future')
  })
})

describe('doneGroup / isDoneRow', () => {
  it('splits Done rows into published and archived', () => {
    expect(doneGroup({ status: 'published', list_id: 'refined' })).toBe(
      'published'
    )
    expect(doneGroup({ status: 'published', list_id: 'done' })).toBe(
      'published'
    )
    expect(doneGroup({ status: 'archived', list_id: 'done' })).toBe('archived')
    expect(doneGroup({ status: 'processed', list_id: 'done' })).toBe('archived')
  })
  it('keeps live and inbox rows out of Done', () => {
    expect(isDoneRow({ status: 'processed', list_id: 'inbox' })).toBe(false)
    expect(isDoneRow({ status: 'processed', list_id: 'refined' })).toBe(false)
    expect(isDoneRow({ status: 'published', list_id: 'refined' })).toBe(true)
    expect(isDoneRow({ status: 'archived', list_id: 'done' })).toBe(true)
  })
})

describe('isPostEligible', () => {
  it('accepts refined events with the Post service, not held ones', () => {
    expect(isPostEligible(row({}))).toBe(false)
    expect(isPostEligible(row({ list_id: 'refined' }))).toBe(true)
  })
  it('rejects resources, failures, processing and opted-out rows', () => {
    expect(isPostEligible(row({ type: 'resource' }))).toBe(false)
    expect(isPostEligible(row({ list_id: 'refined', status: 'failed' }))).toBe(
      false
    )
    expect(isPostEligible(row({ status: 'processing' }))).toBe(false)
    expect(isPostEligible(row({ services: ['newsletter'] }))).toBe(false)
  })
})

describe('effectiveStart for recurring events', () => {
  it('recomputes the next occurrence when the stored one is missing or stale', () => {
    const next = effectiveStart(
      row({
        start_date: '2020-01-06',
        repeat_rrule: 'FREQ=WEEKLY;BYDAY=MO',
        repeat_next_date: null,
      }),
      '2026-11-13'
    )
    expect(next).toBeTruthy()
    expect(next! > '2020-01-06').toBe(true)
  })
})

describe('needsAttention', () => {
  it('flags failed parses and past one-off events', () => {
    expect(needsAttention(row({ status: 'failed' }), '2026-11-13')).toBe(true)
    expect(
      needsAttention(row({ start_date: '2026-11-01' }), '2026-11-13')
    ).toBe(true)
    expect(
      needsAttention(row({ start_date: '2026-12-01' }), '2026-11-13')
    ).toBe(false)
  })
})
