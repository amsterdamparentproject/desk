import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Board from '../app/components/Board'
import { createActivity, saveActivity, deleteActivity, archiveActivity, uploadActivityFile } from '../app/actions/activities'
import { postDesk } from '../lib/PostToWebhook'
import type { DeskActivity } from '../app/types/activity'

vi.mock('../app/actions/activities', () => ({
  createActivity: vi.fn(),
  saveActivity: vi.fn(),
  deleteActivity: vi.fn(),
  archiveActivity: vi.fn(),
  moveActivity: vi.fn(),
  uploadActivityFile: vi.fn(),
  pollForUpdates: vi.fn().mockResolvedValue([]),
}))

vi.mock('../lib/PostToWebhook', () => ({
  postDesk: vi.fn(),
}))

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
    snooze_until: null,
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
})

// ─── Capture via AI ───────────────────────────────────────────────────────────

describe('capture via AI', () => {
  it.each([['event'], ['resource']] as const)(
    'creates %s without file',
    async (type) => {
      const user = userEvent.setup()
      vi.mocked(postDesk).mockResolvedValue({ success: true, status: 200, data: null })

      render(<Board initialActivities={[]} initialPublishDate={DEFAULT_PUBLISH_DATE} />)


      const textarea = await screen.findByPlaceholderText('Paste links, type titles, or add notes...')
      await user.type(textarea, 'Test description')

      if (type === 'resource') {
        await user.click(screen.getByText('Res'))
      }

      fireEvent.submit(textarea.closest('form')!)

      await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1))
      expect(createActivity).toHaveBeenCalledWith(
        expect.any(String),
        type,
        expect.objectContaining({ list_id: 'ideas', status: 'processing' }),
      )
      expect(postDesk).toHaveBeenCalledWith(expect.objectContaining({ action: 'add', type }))
    },
  )

  it.each([['event'], ['resource']] as const)(
    'creates %s with file (uploads first and preserves file_url)',
    async (type) => {
      const user = userEvent.setup()
      vi.mocked(postDesk).mockResolvedValue({ success: true, status: 200, data: null })

      render(<Board initialActivities={[]} initialPublishDate={DEFAULT_PUBLISH_DATE} />)


      const textarea = await screen.findByPlaceholderText('Paste links, type titles, or add notes...')
      await user.type(textarea, 'Description with file')

      if (type === 'resource') {
        await user.click(screen.getByText('Res'))
      }

      const fileInput = document.querySelector('input[type="file"]')! as HTMLInputElement
      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      await user.upload(fileInput, file)

      fireEvent.submit(textarea.closest('form')!)

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
    vi.mocked(postDesk).mockResolvedValue({ success: true, status: 200, data: null })

    render(<Board initialActivities={[]} initialPublishDate={DEFAULT_PUBLISH_DATE} />)

    const textarea = await screen.findByPlaceholderText('Paste links, type titles, or add notes...')
    await user.type(textarea, 'Multi-event description')
    fireEvent.submit(textarea.closest('form')!)

    // Only the seed createActivity call — extra items created server-side by /api/desk/callback
    await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1))
    expect(createActivity).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ list_id: 'ideas', status: 'processing' }),
    )
    expect(postDesk).toHaveBeenCalledWith(expect.objectContaining({ action: 'add' }))
  })
})

// ─── Card actions (triage tab, default) ──────────────────────────────────────

describe('card actions', () => {
  it('archives event', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} initialPublishDate={DEFAULT_PUBLISH_DATE} />)

    // Board starts on triage — 'Archive' button is on the card (exact case avoids
    // matching the 'archived (0)' tab label)
    await user.click(await screen.findByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(archiveActivity).toHaveBeenCalledWith('act-1', 'event'))
  })

  it('snoozes event to day after newsletter date', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} initialPublishDate={DEFAULT_PUBLISH_DATE} />)

    await user.click(await screen.findByRole('button', { name: 'Snooze' }))

    await waitFor(() =>
      expect(saveActivity).toHaveBeenCalledWith(
        'act-1',
        'event',
        expect.objectContaining({ status: 'snoozed', snooze_until: '2026-05-19' }),
      ),
    )
  })
})

// ─── ActivityDrawer ───────────────────────────────────────────────────────────

describe('ActivityDrawer', () => {
  it('saves newsletter_description', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} initialPublishDate={DEFAULT_PUBLISH_DATE} />)

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
    render(<Board initialActivities={[activity()]} initialPublishDate={DEFAULT_PUBLISH_DATE} />)

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    await user.click(await screen.findByRole('button', { name: /delete record permanently/i }))
    await user.click(await screen.findByRole('button', { name: /yes, delete/i }))

    await waitFor(() => expect(deleteActivity).toHaveBeenCalledWith('act-1', 'event'))
  })
})
