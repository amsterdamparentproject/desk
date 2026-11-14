import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Board from '../app/components/Board'
import {
  createActivity,
  saveActivity,
  deleteActivity,
  archiveActivity,
  uploadActivityFile,
} from '../app/actions/activities'
import type { DeskActivity } from '../app/types/activity'

let mockSearch = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

vi.mock('../app/actions/activities', () => ({
  createActivity: vi.fn(),
  saveActivity: vi.fn(),
  deleteActivity: vi.fn(),
  archiveActivity: vi.fn(),
  moveActivity: vi.fn(),
  uploadActivityFile: vi.fn(),
  flagParseError: vi.fn().mockResolvedValue(undefined),
  convertActivityType: vi.fn().mockResolvedValue({}),
  dismissParseNotice: vi.fn().mockResolvedValue(undefined),
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
    age_categories: [],
    categories: [],
    postpartum_post: false,
    services: [],
    latitude: null,
    longitude: null,
    snooze_until: null,
    last_triaged_at: null,
    triage_notes: null,
    file_url: null,
    repeat_frequency: null,
    repeat_next_date: null,
    calendar_skip: false,
    calendar_sent: false,
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

const DEFAULT_PUBLISH_DATE = '2026-05-18'

beforeEach(() => {
  vi.clearAllMocks()
  mockSearch = ''
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
  const PLACEHOLDER = /paste a link, type a title/i

  it.each([['event'], ['resource']] as const)(
    'creates %s without file',
    async (type) => {
      const user = userEvent.setup()
      render(<Board initialActivities={[]} />)

      const textarea = await screen.findByPlaceholderText(PLACEHOLDER)
      const form = textarea.closest('form')!
      if (type === 'resource') {
        await user.click(within(form).getByRole('button', { name: 'resource' }))
      }
      await user.type(textarea, 'Test description')

      fireEvent.submit(form)

      await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1))
      expect(createActivity).toHaveBeenCalledWith(
        expect.any(String),
        type,
        expect.objectContaining({ list_id: 'ideas', status: 'processing' })
      )
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/desk/send',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"action":"add"'),
          })
        )
      )
    }
  )

  it.each([['event'], ['resource']] as const)(
    'creates %s with file (uploads first and preserves file_url)',
    async (type) => {
      const user = userEvent.setup()
      render(<Board initialActivities={[]} />)

      const textarea = await screen.findByPlaceholderText(PLACEHOLDER)
      const form = textarea.closest('form')!
      if (type === 'resource') {
        await user.click(within(form).getByRole('button', { name: 'resource' }))
      }
      await user.type(textarea, 'Description with file')

      const fileInput = form.querySelector(
        'input[type="file"]'
      )! as HTMLInputElement
      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
      await user.upload(fileInput, file)

      fireEvent.submit(form)

      await waitFor(() =>
        expect(uploadActivityFile).toHaveBeenCalledWith(
          expect.any(String),
          file
        )
      )
      await waitFor(() =>
        expect(createActivity).toHaveBeenCalledWith(
          expect.any(String),
          type,
          expect.objectContaining({ file_url: FILE_URL })
        )
      )
    }
  )

  it('fires webhook and creates seed record (multi-item split handled by callback route)', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[]} />)

    const textarea = await screen.findByPlaceholderText(PLACEHOLDER)
    const form = textarea.closest('form')!
    await user.type(textarea, 'Multi-event description')
    fireEvent.submit(form)

    // Only the seed createActivity call — extra items created server-side by /api/desk/callback
    await waitFor(() => expect(createActivity).toHaveBeenCalledTimes(1))
    expect(createActivity).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ list_id: 'ideas', status: 'processing' })
    )
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/desk/send',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"add"'),
        })
      )
    )
  })
})

// ─── Card actions (triage tab, default) ──────────────────────────────────────

describe('card actions', () => {
  it('archives event', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} />)

    // Board starts on triage — the row's Archive button (exact name avoids
    // matching the 'archived (0)' tab label)
    await user.click(await screen.findByRole('button', { name: 'Archive' }))

    await waitFor(() =>
      expect(archiveActivity).toHaveBeenCalledWith('act-1', 'event')
    )
  })
})

describe('desk table', () => {
  it('moves a held row with services to upcoming events on Done refining', async () => {
    const user = userEvent.setup()
    render(
      <Board
        initialActivities={[
          activity({ start_date: '2099-01-01', services: ['newsletter'] }),
        ]}
      />
    )

    const row = (await screen.findByText('Test Event')).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Done refining' }))

    await waitFor(() =>
      expect(saveActivity).toHaveBeenCalledWith(
        'act-1',
        'event',
        expect.objectContaining({
          list_id: 'upcoming_events',
          status: 'accepted',
        })
      )
    )
  })

  it('shows refine, review and error rows in one table', async () => {
    render(
      <Board
        initialActivities={[
          activity({ id: 'a', title: 'Alpha', list_id: 'refine' }),
          activity({ id: 'b', title: 'Bravo', list_id: 'error' }),
          activity({ id: 'c', title: 'Charlie', list_id: 'next_newsletter' }),
        ]}
      />
    )
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Bravo')).toBeInTheDocument()
    expect(screen.queryByText('Charlie')).not.toBeInTheDocument()
  })
})

// ─── ActivityDrawer ───────────────────────────────────────────────────────────

describe('ActivityDrawer', () => {
  it('saves newsletter_description', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} />)

    // Board starts on triage; clicking the row opens the drawer
    await user.click(await screen.findByText('Test Event'))

    const blurb = await screen.findByPlaceholderText(/newsletter snippet/i)
    await user.clear(blurb)
    await user.type(blurb, 'Updated newsletter blurb')

    fireEvent.blur(blurb)

    await waitFor(() =>
      expect(saveActivity).toHaveBeenCalledWith(
        'act-1',
        'event',
        expect.objectContaining({
          newsletter_description: 'Updated newsletter blurb',
        })
      )
    )
  })

  it('deletes activity (two-step confirm)', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} />)

    await user.click(await screen.findByText('Test Event'))

    await user.click(
      await screen.findByRole('button', { name: /delete record permanently/i })
    )
    await user.click(
      await screen.findByRole('button', { name: /yes, delete/i })
    )

    await waitFor(() =>
      expect(deleteActivity).toHaveBeenCalledWith('act-1', 'event')
    )
  })

  it('syncs the recurrence rule when repeat controls change', async () => {
    const user = userEvent.setup()
    render(<Board initialActivities={[activity()]} />)

    await user.click(await screen.findByText('Test Event'))

    const frequency = (await screen.findAllByRole('combobox')).find((el) =>
      within(el).queryByRole('option', { name: 'Weekly' })
    )!
    await user.selectOptions(frequency, 'weekly')
    await user.click(await screen.findByRole('button', { name: 'Mon' }))
    fireEvent.blur(frequency)

    await waitFor(() =>
      expect(saveActivity).toHaveBeenCalledWith(
        'act-1',
        'event',
        expect.objectContaining({
          repeat_frequency: 'weekly',
          repeat_rrule: expect.stringMatching(/FREQ=WEEKLY.*BYDAY=MO/),
        })
      )
    )
  })

  it('opens the drawer for the activity named in the URL', async () => {
    mockSearch = 'type=event&id=act-1'
    render(<Board initialActivities={[activity()]} />)

    expect(
      await screen.findByPlaceholderText(/newsletter snippet/i)
    ).toBeInTheDocument()
  })
})
