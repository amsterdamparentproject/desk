import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Board from '../app/components/Board'
import { createActivity, saveActivity, deleteActivity, archiveActivity, uploadActivityFile } from '../app/actions/activities'
import type { DeskActivity } from '../app/types/activity'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('../app/actions/activities', () => ({
  createActivity: vi.fn(),
  saveActivity: vi.fn(),
  deleteActivity: vi.fn(),
  archiveActivity: vi.fn(),
  moveActivity: vi.fn(),
  uploadActivityFile: vi.fn(),
  pollForUpdates: vi.fn().mockResolvedValue([]),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const FILE_URL = 'https://storage.example.com/activities/test.jpg'

function activity(overrides: Partial<DeskActivity> = {}): DeskActivity {
  return {
    id: 'act-1',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    list_id: 'review',
    status: 'processed',
    source: 'app_desk',
    title: 'Test Event',
    description: 'Test description',
    newsletter_description: 'Original blurb',
    url: null,
    organization: null,
    age_range: null,
    categories: [],
    last_triaged_at: null,
    triage_notes: null,
    file_url: null,
    location: null,
    neighborhood: null,
    area: null,
    newsletter_last: null,
    newsletter_highlight: false,
    type: 'event',
    file: null,
    preview_url: null,
    start_date: '2026-06-15',
    ...overrides,
  }
}

function webhookData(overrides: Partial<DeskActivity> = {}): DeskActivity {
  return activity({ title: 'AI Title', newsletter_description: 'AI blurb', file_url: null, ...overrides })
}

const DEFAULT_PUBLISH_DATE = '2026-05-18'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createActivity).mockResolvedValue(undefined)
  vi.mocked(saveActivity).mockResolvedValue(undefined)
  vi.mocked(deleteActivity).mockResolvedValue(undefined)
  vi.mocked(archiveActivity).mockResolvedValue(undefined)
  vi.mocked(uploadActivityFile).mockResolvedValue(FILE_URL)
  fetchMock.mockResolvedValue({ ok: true } as Response)
  localStorage.clear()
  localStorage.setItem('desk_publish_date', DEFAULT_PUBLISH_DATE)
})

// ─── Capture via AI ───────────────────────────────────────────────────────────

describe('capture via AI', () => {
  it.each([['event'], ['resource']] as const)(
    'creates %s without file',
    async (type) => {
      const user = userEvent.setup()
      render(<Board initialActivities={[]} />)


      const sectionLabel = type === 'resource' ? 'Resource' : 'Event'
      const heading = await screen.findByText(sectionLabel, { selector: 'p' })
      const form = heading.closest('form')!
      const textarea = within(form).getByPlaceholderText('Paste links, type titles, or add notes...')
      await user.type(textarea, 'Test description')

      fireEvent.submit(form)

      await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1))
      expect(createActivity).toHaveBeenCalledWith(
        expect.any(String),
        type,
        expect.objectContaining({ list_id: 'ideas', status: 'processing' }),
      )
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        '/api/desk/send',
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('"action":"add"') }),
      ))
    },
  )

  it.each([['event'], ['resource']] as const)(
    'creates %s with file (uploads first and preserves file_url)',
    async (type) => {
      const user = userEvent.setup()
      render(<Board initialActivities={[]} />)


      const sectionLabel = type === 'resource' ? 'Resource' : 'Event'
      const heading = await screen.findByText(sectionLabel, { selector: 'p' })
      const form = heading.closest('form')!
      const textarea = within(form).getByPlaceholderText('Paste links, type titles, or add notes...')
      await user.type(textarea, 'Description with file')

      const fileInput = form.querySelector('input[type="file"]')! as HTMLInputElement
      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      await user.upload(fileInput, file)

      fireEvent.submit(form)

      await waitFor(() => expect(uploadActivityFile).toHaveBeenCalledWith(expect.any(String), file))
      await waitFor(() =>
        expect(createActivity).toHaveBeenCalledWith(
          expect.any(String),
          type,
          expect.objectContaining({ file_url: FILE_URL }),
        ),
      )
    },
  )

  it('fires webhook and creates seed record (multi-item split handled by callback route)', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[]} />)

    const heading = await screen.findByText('Event', { selector: 'p' })
    const form = heading.closest('form')!
    const textarea = within(form).getByPlaceholderText('Paste links, type titles, or add notes...')
    await user.type(textarea, 'Multi-event description')
    fireEvent.submit(form)

    // Only the seed createActivity call — extra items created server-side by /api/desk/callback
    await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1))
    expect(createActivity).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ list_id: 'ideas', status: 'processing' }),
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/desk/send',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"action":"add"') }),
    ))
  })
})

// ─── Card actions (triage tab, default) ──────────────────────────────────────

describe('card actions', () => {
  it('archives event', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} />)

    // Board starts on triage — 'Archive' button is on the card (exact case avoids
    // matching the 'archived (0)' tab label)
    await user.click(await screen.findByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(archiveActivity).toHaveBeenCalledWith('act-1', 'event'))
  })

})

// ─── ActivityDrawer ───────────────────────────────────────────────────────────

describe('ActivityDrawer', () => {
  it('saves newsletter_description', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} />)

    // Board starts on triage; activity is in 'review' column
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const blurb = await screen.findByPlaceholderText(/newsletter snippet/i)
    await user.clear(blurb)
    await user.type(blurb, 'Updated newsletter blurb')

    fireEvent.blur(blurb)

    await waitFor(() =>
      expect(saveActivity).toHaveBeenCalledWith(
        'act-1',
        'event',
        expect.objectContaining({ newsletter_description: 'Updated newsletter blurb' }),
      ),
    )
  })

  it('deletes activity (two-step confirm)', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} />)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    await user.click(await screen.findByRole('button', { name: /delete record permanently/i }))
    await user.click(await screen.findByRole('button', { name: /yes, delete/i }))

    await waitFor(() => expect(deleteActivity).toHaveBeenCalledWith('act-1', 'event'))
  })
})
