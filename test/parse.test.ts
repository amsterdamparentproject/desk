import { describe, it, expect } from 'vitest'
import {
  extractFailure,
  todayInAmsterdam,
  validateParsed,
} from '../lib/parse/schema'
import { safeFileName } from '../lib/parse/files'
import { childActivityId } from '../lib/parse/ids'
import { failurePatch, staleCutoffIso } from '../lib/parse/sweep'

const today = '2026-11-13'

describe('validateParsed', () => {
  it('normalises messy-but-usable AI output and drops fields the AI must not control', () => {
    const r = validateParsed(
      {
        id: 'x',
        type: 'event',
        title: ' Book on Lap ',
        description: 'Storytime',
        start_date: '2026-12-14',
        end_date: '2026-12-14',
        start_time: '13:00:00',
        end_time: '9:30',
        area: 'Centre',
        repeat_frequency: 'Weekly',
        repeat_rrule: 'FREQ=WEEKLY;BYDAY=FR',
        age_range: 'N/A',
        file_url: 'https://example.com/hallucinated.png',
        list_id: 'gone',
        status: 'published',
        services: [],
      },
      { today, seedType: 'event' }
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toMatchObject({
      title: 'Book on Lap',
      start_time: '13:00',
      end_time: '09:30',
      area: 'Center',
      repeat_frequency: 'weekly',
      age_range: null,
      end_date: null, // echoed start_date is dropped
    })
    for (const key of ['file_url', 'list_id', 'status', 'services', 'id']) {
      expect(r.data).not.toHaveProperty(key)
    }
    expect(r.warnings).toEqual([])
  })

  it('drops invalid fields with a warning instead of failing the parse', () => {
    const r = validateParsed(
      {
        title: 'T',
        description: 'D',
        start_date: 'next Friday',
        area: 'Somewhere',
        start_time: '25:99',
      },
      { today, seedType: 'event' }
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).not.toHaveProperty('start_date')
    expect(r.data).not.toHaveProperty('area')
    expect(r.data).not.toHaveProperty('start_time')
    expect(r.warnings.join('\n')).toMatch(/start_date/)
    expect(r.warnings.join('\n')).toMatch(/No usable date/)
  })

  it('rejects impossible calendar dates', () => {
    const r = validateParsed(
      { title: 'T', description: 'D', start_date: '2026-02-30' },
      { today, seedType: 'event' }
    )
    expect(r.ok && 'start_date' in r.data).toBe(false)
  })

  it('warns about past and far-future dates, but not for recurring series', () => {
    const base = { title: 'T', description: 'D' }
    const past = validateParsed(
      { ...base, start_date: '2025-12-14' },
      { today, seedType: 'event' }
    )
    expect(past.ok && past.warnings.some((w) => /in the past/.test(w))).toBe(
      true
    )

    const far = validateParsed(
      { ...base, start_date: '2028-12-14' },
      { today, seedType: 'event' }
    )
    expect(far.ok && far.warnings.some((w) => /18 months/.test(w))).toBe(true)

    const recurring = validateParsed(
      {
        ...base,
        start_date: '2025-12-14',
        repeat_rrule: 'FREQ=WEEKLY;BYDAY=FR',
      },
      { today, seedType: 'event' }
    )
    expect(recurring.ok && recurring.warnings).toEqual([])
  })

  it('warns when the AI type disagrees with the record type', () => {
    const r = validateParsed(
      { type: 'resource', title: 'T', description: 'D' },
      { today, seedType: 'event' }
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.aiType).toBe('resource')
    expect(r.warnings.some((w) => /treated this as a resource/.test(w))).toBe(
      true
    )
  })

  it('fails only when there is nothing usable', () => {
    expect(validateParsed(null).ok).toBe(false)
    expect(validateParsed([]).ok).toBe(false)
    expect(validateParsed({ type: 'event', start_date: '2026-12-01' }).ok).toBe(
      false
    )
    const r = validateParsed({ description: 'Only a description' })
    expect(r.ok && r.data.title).toBe('Only a description')
  })
})

describe('extractFailure', () => {
  it('ignores n8n noise next to a real result', () => {
    expect(extractFailure({ id: 'a', title: 'ok', error: 'noise' })).toBeNull()
    expect(extractFailure({ title: 'fine' })).toBeNull()
  })

  it('reads explicit and raw n8n failure payloads', () => {
    expect(extractFailure({ id: 'a', failed: true, error: 'boom' })).toEqual({
      id: 'a',
      message: 'boom',
    })
    expect(
      extractFailure({
        error: { message: 'Scrape failed' },
        submissionData: { id: 'b' },
      })
    ).toEqual({ id: 'b', message: 'Scrape failed' })
    expect(
      extractFailure({ error: { message: 'x' }, body: { id: 'c' } })?.id
    ).toBe('c')
  })
})

describe('safeFileName', () => {
  it('replaces characters that break storage paths', () => {
    // macOS screenshots use U+202F before AM/PM
    expect(safeFileName('Screenshot 2026-11-13 at 8.44.12 PM.png')).toBe(
      'Screenshot_2026-11-13_at_8.44.12_PM.png'
    )
    expect(safeFileName('café flyer (1).JPG')).toBe('cafe_flyer_1_.JPG')
  })

  it('never returns an empty name', () => {
    expect(safeFileName('???')).toBe('upload')
    expect(safeFileName(undefined)).toBe('upload')
  })
})

describe('childActivityId', () => {
  it('is stable per parent+index and looks like a uuid', () => {
    const a = childActivityId('parent', 1)
    expect(a).toBe(childActivityId('parent', 1))
    expect(a).not.toBe(childActivityId('parent', 2))
    expect(a).not.toBe(childActivityId('other', 1))
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})

describe('failurePatch / staleCutoffIso', () => {
  it('moves fresh cards to Error but never yanks promoted cards back', () => {
    expect(failurePatch('ideas')).toEqual({ list_id: 'error', status: 'new' })
    expect(failurePatch('error')).toEqual({ list_id: 'error', status: 'new' })
    expect(failurePatch('refine')).toEqual({ status: 'processed' })
    expect(failurePatch('upcoming_events')).toEqual({ status: 'accepted' })
    expect(failurePatch('gone')).toEqual({})
  })

  it('computes the stuck cutoff', () => {
    expect(staleCutoffIso(new Date('2026-11-13T12:00:00Z'), 5)).toBe(
      '2026-11-13T11:55:00.000Z'
    )
  })

  it('reads "today" in Amsterdam, not UTC', () => {
    expect(todayInAmsterdam(new Date('2026-11-13T23:30:00Z'))).toBe(
      '2026-11-14'
    )
  })
})
