import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/utils/supabase/server'
import { authorizePostRequest } from '@/lib/auth/post-auth'
import { amsterdamToday, isIsoDate } from '@/lib/issue-date'
import { expandEvent, freeOn, parseDays, weekdayOf } from '@/lib/post-feed'

export const dynamic = 'force-dynamic'

const MAX_WINDOW_DAYS = 100
const EVENT_COLUMNS =
  'id, title, description, url, organization, location, neighborhood, area, latitude, longitude, categories, age_categories, start_date, end_date, start_time, end_time, repeat_rrule, occurrences, tagline, newsletter_description'
const LOCATION_COLUMNS =
  'id, name, description, url, address, neighborhood, area, latitude, longitude, age_categories'

/**
 * Feed for Postpartum Post's match page. Desk decides what is eligible
 * (refined, tagged postpartum_post, live) and expands recurring / multi-date
 * events into one row per occurrence, so Post needs no knowledge of Desk's
 * lists, statuses or recurrence rules.
 *
 *   GET /api/post/activities?from=YYYY-MM-DD&to=YYYY-MM-DD
 *       [&member1_days=Monday,Tuesday][&member2_days=...][&available_only=true]
 *
 * Auth: `Authorization: Bearer ${POST_DESK_SECRET}` (lib/auth/post-auth).
 * Empty/absent member days mean "free every day".
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const auth = authorizePostRequest(request.headers)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) {
    return NextResponse.json(
      { error: 'from and to must be YYYY-MM-DD, to >= from' },
      { status: 400 }
    )
  }
  const spanDays = (Date.parse(to) - Date.parse(from)) / 86400000
  if (spanDays > MAX_WINDOW_DAYS) {
    return NextResponse.json(
      { error: `window is limited to ${MAX_WINDOW_DAYS} days` },
      { status: 400 }
    )
  }

  const m1 = parseDays(searchParams.get('member1_days'))
  const m2 = parseDays(searchParams.get('member2_days'))
  const availableOnly = searchParams.get('available_only') === 'true'
  const today = amsterdamToday()

  const supabase = createAdminClient()
  const [eventsRes, locationsRes] = await Promise.all([
    supabase
      .from('events')
      .select(EVENT_COLUMNS)
      .eq('postpartum_post', true)
      .eq('list_id', 'refined')
      .not('status', 'in', '(new,processing,failed,archived)'),
    supabase
      .from('locations')
      .select(LOCATION_COLUMNS)
      .eq('postpartum_post', true)
      .eq('list_id', 'refined'),
  ])
  if (eventsRes.error || locationsRes.error) {
    console.error(
      '[post-feed]',
      eventsRes.error?.message ?? locationsRes.error?.message
    )
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const events = (eventsRes.data ?? []).flatMap((e) =>
    expandEvent(e, from, to, today).map((slot) => {
      const weekday = weekdayOf(slot.date)
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        url: e.url,
        organization: e.organization,
        location: e.location,
        neighborhood: e.neighborhood,
        area: e.area,
        latitude: e.latitude,
        longitude: e.longitude,
        categories: e.categories ?? [],
        age_categories: e.age_categories ?? [],
        tagline: e.tagline,
        newsletter_description: e.newsletter_description,
        recurring: !!e.repeat_rrule,
        repeat_rrule: e.repeat_rrule,
        date: slot.date,
        weekday,
        start_time: slot.start_time,
        end_time: slot.end_time,
        member1_available: freeOn(m1, weekday),
        member2_available: freeOn(m2, weekday),
        both_available: freeOn(m1, weekday) && freeOn(m2, weekday),
      }
    })
  )
  const rows = (
    availableOnly ? events.filter((e) => e.both_available) : events
  ).sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
  )

  return NextResponse.json(
    {
      from,
      to,
      generated_at: new Date().toISOString(),
      events: rows,
      locations: locationsRes.data ?? [],
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
