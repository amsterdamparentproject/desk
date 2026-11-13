import { describe, it, expect } from 'vitest'
import { convertRow, describeSchedule } from '../lib/convert'

const event = {
  id: 'a',
  title: 'Book on Lap',
  list_id: 'upcoming_events',
  services: ['newsletter', 'postpartum_post'],
  postpartum_post: true,
  triage_notes: null,
  start_date: '2026-12-14',
  end_date: null,
  start_time: '13:00:00',
  end_time: '16:00:00',
  repeat_rrule: 'FREQ=WEEKLY;BYDAY=FR',
  tagline: 'x',
  calendar_skip: false,
}

describe('convertRow', () => {
  it('event -> resource drops event columns and Post', () => {
    const { insert, patch } = convertRow(event, 'resource', '2026-11-13')
    expect(insert.start_date).toBeUndefined()
    expect(insert.tagline).toBeUndefined()
    expect(insert.calendar_skip).toBeUndefined()
    expect(insert.title).toBe('Book on Lap')
    expect(patch.list_id).toBe('new_resources')
    expect(patch.services).toEqual(['newsletter'])
    expect(patch.postpartum_post).toBe(false)
  })

  it('event -> resource keeps the schedule in triage_notes', () => {
    const { patch } = convertRow(
      { ...event, triage_notes: 'hi' },
      'resource',
      '2026-11-13'
    )
    expect(patch.triage_notes).toBe(
      'hi\nWas an event: 2026-12-14 13:00–16:00 (repeats: FREQ=WEEKLY;BYDAY=FR)'
    )
  })

  it('Post-only event still lands in the newsletter service', () => {
    const { patch } = convertRow(
      { ...event, services: ['postpartum_post'] },
      'resource',
      '2026-11-13'
    )
    expect(patch.services).toEqual(['newsletter'])
  })

  it('leaves other lists alone', () => {
    const { patch } = convertRow(
      { ...event, list_id: 'review' },
      'resource',
      '2026-11-13'
    )
    expect(patch.list_id).toBe('review')
  })

  it('resource -> event sets a placeholder date and moves list', () => {
    const { insert, patch } = convertRow(
      {
        id: 'b',
        title: 'Guide',
        list_id: 'new_resources',
        services: ['newsletter'],
        postpartum_post: false,
        parse_warnings: [],
      },
      'event',
      '2026-11-13'
    )
    expect(insert.start_date).toBe('2026-11-13')
    expect(patch.list_id).toBe('upcoming_events')
    expect(insert.services).toEqual(['newsletter'])
    expect(insert.parse_warnings).toEqual([
      'Converted from a resource. Set the real date and time.',
    ])
  })

  it('does not add warnings when the diagnostics column is absent', () => {
    const { insert } = convertRow(
      { id: 'b', title: 'Guide', list_id: 'review', services: [] },
      'event',
      '2026-11-13'
    )
    expect(insert.parse_warnings).toBeUndefined()
  })
})

describe('describeSchedule', () => {
  it('returns null without a start date', () => {
    expect(describeSchedule({})).toBeNull()
  })
})
