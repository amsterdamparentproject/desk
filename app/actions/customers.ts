'use server'

import { stripe } from '@/lib/stripe/client'
import { mapSessionToRow } from '@/lib/stripe/mapper'
import type { CustomerRow } from '@/lib/stripe/types'
import type Stripe from 'stripe'

/**
 * Fetch all completed Checkout Sessions from Stripe and map them to CustomerRow[].
 * Stripe is the single source of truth — no Supabase table.
 */
export async function getCustomerRoster(): Promise<CustomerRow[]> {
  const sessions: Stripe.Checkout.Session[] = []

  // Auto-paginate all completed sessions
  for await (const session of stripe.checkout.sessions.list({
    limit: 100,
    status: 'complete',
    expand: ['data.line_items', 'data.subscription'],
  })) {
    sessions.push(session)
  }

  const rows = await Promise.all(
    sessions.map(async (session) => {
      // Prefer already-expanded line_items; fall back to a per-session fetch
      let lineItemDescription: string | null = null
      const lineItems = session.line_items as Stripe.ApiList<Stripe.LineItem> | undefined
      if (lineItems?.data?.length) {
        lineItemDescription = lineItems.data[0].description ?? null
      } else {
        try {
          const fetched = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
          lineItemDescription = fetched.data[0]?.description ?? null
        } catch {
          // best-effort
        }
      }

      const subscription =
        session.subscription && typeof session.subscription !== 'string'
          ? (session.subscription as Stripe.Subscription)
          : null

      return mapSessionToRow({ session, lineItemDescription, subscription })
    }),
  )

  return rows
}
