// lib/stripe/mapper.ts
// Ports the n8n Code node logic that produces the customer roster shape.
import type Stripe from 'stripe'
import type { CustomerRow, CustomField } from './types'

const ACCOUNT_ID = 'acct_1SPjE2QXyrloqZVh'

// Beautify raw Stripe dropdown values → human-readable labels
export const VALUE_MAP: Record<string, string> = {
  east: 'Amsterdam East',
  west: 'Amsterdam West',
  janfeb: 'Jan/Feb',
  marapr: 'Mar/Apr',
  mayjun: 'May/Jun',
  julaug: 'Jul/Aug',
  sepoct: 'Sep/Oct',
  novdec: 'Nov/Dec',
}

function beautify(raw: string | null | undefined): string {
  if (!raw) return ''
  return VALUE_MAP[raw] ?? raw
}

function mapProductName(description: string | null | undefined): string {
  switch (description) {
    case 'For multi-parent families':
      return 'Fourth Trimester Program (Multi-parent)'
    case 'For single parent families':
      return 'Fourth Trimester Program (Single parent)'
    default:
      return description ?? 'Unknown product'
  }
}

function mapCustomFields(
  raw: Stripe.Checkout.Session['custom_fields'],
): CustomField[] {
  if (!raw || raw.length === 0) return []
  return raw.map((field) => ({
    label: field.label.custom ?? field.label.type ?? '',
    value: beautify(field.dropdown?.value ?? field.text?.value ?? ''),
  }))
}

export interface SessionWithLineItem {
  session: Stripe.Checkout.Session
  lineItemDescription: string | null
  /** Subscription object, if already expanded */
  subscription?: Stripe.Subscription | null
}

export function mapSessionToRow({
  session,
  lineItemDescription,
  subscription,
}: SessionWithLineItem): CustomerRow {
  const livemode = session.livemode
  const modePath = livemode ? '' : '/test'
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? ''

  const dashboardUrl = `https://dashboard.stripe.com/${ACCOUNT_ID}${modePath}/payments/${paymentIntentId}`

  // Determine active status
  let isActive: boolean
  if (session.mode === 'subscription') {
    const subStatus = subscription?.status ?? 'unknown'
    isActive = subStatus === 'active' || subStatus === 'trialing'
  } else {
    // one-time: active once paid
    isActive = session.payment_status === 'paid'
  }

  const details = session.customer_details
  const name = details?.name ?? ''
  const email = details?.email ?? ''

  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null

  return {
    sessionId: session.id,
    customerId,
    name,
    email,
    product: mapProductName(lineItemDescription),
    mode: session.mode === 'subscription' ? 'subscription' : 'payment',
    status: session.payment_status,
    isActive,
    amount: (session.amount_total ?? 0) / 100,
    currency: session.currency ?? 'eur',
    created: session.created,
    customFields: mapCustomFields(session.custom_fields),
    dashboardUrl,
    isTest: !livemode,
  }
}
