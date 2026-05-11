import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createAdminClient } from '@/app/utils/supabase/server'
import { saveActivity } from '../app/actions/activities'

vi.mock('@/app/utils/supabase/server', () => ({
  createAdminClient: vi.fn(),
}))

// Builds a chainable Supabase mock: from().update().eq() or from().select().eq().single()
function makeSupabaseMock({ updateError = null, selectData = null }: { updateError?: any; selectData?: any } = {}) {
  const mockEqUpdate = vi.fn().mockResolvedValue({ error: updateError })
  const mockEqSelect = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: selectData, error: null }) })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate })
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate, select: mockSelect })
  return { client: { from: mockFrom }, mockFrom, mockUpdate, mockEqUpdate }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saveActivity – date & time', () => {
  it('passes single-day and multi-day date ranges to Supabase', async () => {
    const { client, mockUpdate } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(client as any)

    // Single-day: no end_date
    await saveActivity('id-1', 'event', {
      start_date: '2026-06-01',
      end_date: null,
      start_time: '10:00',
      end_time: null,
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ start_date: '2026-06-01', end_date: null }),
    )

    // Multi-day: end_date set
    await saveActivity('id-2', 'event', {
      start_date: '2026-06-01',
      end_date: '2026-06-03',
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ start_date: '2026-06-01', end_date: '2026-06-03' }),
    )
  })
})

describe('saveActivity – repeat fields', () => {
  it('computes repeat_next_date for weekly rrule', async () => {
    const { client, mockUpdate } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(client as any)

    // 2026-06-01 is a Monday; BYDAY=MO → next occurrence is 2026-06-08
    await saveActivity('id-1', 'event', {
      repeat_rrule: 'RRULE:FREQ=WEEKLY;BYDAY=MO',
      repeat_frequency: 'weekly',
      start_date: '2026-06-01',
    })

    const [updatePayload] = vi.mocked(mockUpdate).mock.calls[0]
    const nextDate: string = updatePayload.repeat_next_date
    expect(nextDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const day = new Date(nextDate + 'T00:00:00').getDay() // 0=Sun, 1=Mon
    expect(day).toBe(1) // next occurrence must be a Monday
  })

  it('sets repeat_next_date to null when rrule is cleared', async () => {
    const { client, mockUpdate } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(client as any)

    await saveActivity('id-1', 'event', {
      repeat_rrule: null,
      repeat_frequency: null,
      start_date: '2026-06-01',
    })

    const [updatePayload] = vi.mocked(mockUpdate).mock.calls[0]
    expect(updatePayload.repeat_next_date).toBeNull()
  })
})
