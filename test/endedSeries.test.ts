import { describe, it, expect } from 'vitest'
import { endedSeriesPatch } from '../app/utils/endedSeries'

const base = {
  status: 'accepted',
  list_id: 'upcoming_events',
  services: ['newsletter'],
  repeat_next_date: '2026-10-30',
}

describe('endedSeriesPatch', () => {
  it('ages out a triaged event with only the newsletter service', () => {
    expect(endedSeriesPatch(base)).toEqual({
      repeat_next_date: null,
      services: [],
      postpartum_post: false,
      list_id: 'gone',
    })
  })

  it('keeps the event alive when another service remains', () => {
    const patch = endedSeriesPatch({
      ...base,
      services: ['newsletter', 'postpartum_post'],
    })
    expect(patch).toEqual({
      repeat_next_date: null,
      services: ['postpartum_post'],
      postpartum_post: true,
    })
  })

  it('never touches status, including for published events', () => {
    const patch = endedSeriesPatch({ ...base, status: 'published' })
    expect(patch).not.toHaveProperty('status')
    expect(patch).toHaveProperty('list_id', 'gone')
  })

  it('only clears the date for untriaged events', () => {
    expect(
      endedSeriesPatch({ ...base, status: 'processed', list_id: 'review' })
    ).toEqual({ repeat_next_date: null })
  })

  it('returns null for an already-settled row', () => {
    expect(
      endedSeriesPatch({
        status: 'accepted',
        list_id: 'gone',
        services: [],
        repeat_next_date: null,
      })
    ).toBeNull()
  })

  it('moves an already-empty-services row to gone', () => {
    expect(
      endedSeriesPatch({ ...base, services: null, repeat_next_date: null })
    ).toEqual({ list_id: 'gone' })
  })
})
