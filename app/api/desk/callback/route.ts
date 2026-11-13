import { NextRequest, NextResponse } from 'next/server'
import {
  saveEnrichedCallback,
  upsertEnrichedActivity,
} from '@/app/actions/activities'
import {
  ActivityType,
  extractFailure,
  validateParsed,
} from '@/lib/parse/schema'
import { childActivityId } from '@/lib/parse/ids'
import {
  findDuplicates,
  recordParseFailure,
  resolveActivity,
  tableFor,
  updateWithParseColumns,
} from '@/lib/parse/server'
import { createAdminClient } from '@/app/utils/supabase/server'
import { authorizeN8nRequest } from '@/lib/auth/n8n-auth'

/**
 * Receives the AI parse result from n8n.
 *
 * Always answers 200 for anything that reached a decision (saved, or recorded
 * as a failure on the card) so n8n does not retry or fall into its error
 * branch. Non-2xx is reserved for "could not even read the request".
 *
 * Payload (array or single object):
 *   - parse result:  { id, type?, title, description, start_date, ... }
 *   - failure:       { id, failed: true, error }   — n8n error branches
 * Extra items after the first are additional events split out of the same
 * capture.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const items: unknown[] = Array.isArray(body) ? body : [body]
  const first = items[0] as Record<string, unknown> | undefined
  const failure = extractFailure(first)

  // n8n signs the activity id (HMAC, see lib/auth/n8n-auth.ts).
  const subject =
    failure?.id ?? (typeof first?.id === 'string' ? first.id : null)
  const auth = authorizeN8nRequest(request.headers, subject)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. n8n told us a step failed.
  if (failure) {
    if (!failure.id) {
      return NextResponse.json({ error: 'Failure without id' }, { status: 400 })
    }
    const found = await resolveActivity(failure.id)
    if (!found) {
      return NextResponse.json({ ok: false, reason: 'unknown id' })
    }
    await recordParseFailure(found, failure.id, failure.message, first)
    return NextResponse.json({ ok: false, recorded: true })
  }

  const id = typeof first?.id === 'string' ? first.id : null
  if (!id) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // 2. Find the record. Its real table wins over whatever type the AI reports.
  const found = await resolveActivity(id)

  // 3. Validate what the AI sent.
  const validated = validateParsed(first, { seedType: found?.type ?? null })
  if (!validated.ok) {
    if (found) await recordParseFailure(found, id, validated.reason, first)
    return NextResponse.json({ ok: false, reason: validated.reason })
  }

  const type: ActivityType = found?.type ?? validated.aiType ?? 'event'
  const warnings = [...validated.warnings]

  // 4. Save the first (seed) record. file_url is never taken from the AI.
  if (found) {
    await saveEnrichedCallback(id, type, validated.data)
  } else {
    // The seed row never made it into the database; create it rather than
    // letting the result vanish.
    await upsertEnrichedActivity(id, type, {
      ...validated.data,
      description: validated.data.description ?? validated.data.title ?? '',
      list_id: 'review',
      status: 'processed',
    })
    warnings.push(
      'Original capture record was missing — created from AI result'
    )
  }

  const dupes = await findDuplicates(type, { id, ...validated.data })
  for (const d of dupes) {
    warnings.push(`Possible duplicate of "${d.title}" (${d.list_id})`)
  }

  // 5. Extra events split out of the same capture.
  const supabase = createAdminClient()
  for (const [i, item] of items.slice(1).entries()) {
    const index = i + 1
    const v = validateParsed(item, { seedType: type })
    if (!v.ok) {
      warnings.push(`Extra event #${index} skipped: ${v.reason}`)
      continue
    }
    const childType: ActivityType = v.aiType ?? type
    const childId = childActivityId(id, index)

    // A retried callback finds the card it already created.
    const { data: existing } = await supabase
      .from(tableFor(childType))
      .select('id')
      .eq('id', childId)
      .maybeSingle()
    if (existing) continue

    const childDupes = await findDuplicates(childType, {
      id: childId,
      ...v.data,
    })
    if (childDupes.length > 0) {
      warnings.push(
        `Extra event "${v.data.title}" skipped: duplicate of "${childDupes[0].title}"`
      )
      continue
    }

    try {
      const { inserted } = (await upsertEnrichedActivity(childId, childType, {
        ...v.data,
        description: v.data.description ?? v.data.title ?? '',
        // Same flyer/screenshot as the parent capture.
        ...(found?.file_url ? { file_url: found.file_url } : {}),
        list_id: 'review',
        status: 'processed',
      })) ?? { inserted: true }
      if (!inserted) {
        warnings.push(`Extra event "${v.data.title}" skipped: duplicate`)
      } else if (v.warnings.length > 0) {
        warnings.push(`Extra event "${v.data.title}": ${v.warnings[0]}`)
      }
    } catch (err) {
      warnings.push(
        `Extra event "${v.data.title}" failed to save: ${
          err instanceof Error ? err.message : 'unknown error'
        }`
      )
    }
  }

  // 6. Record the outcome on the card (clears any earlier error).
  await updateWithParseColumns(
    tableFor(type),
    id,
    {},
    { error: null, warnings }
  )

  return NextResponse.json({ ok: true, warnings: warnings.length })
}
