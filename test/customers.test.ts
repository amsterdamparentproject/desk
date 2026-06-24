import { describe, it, expect } from 'vitest'
import { mapSessionToRow, VALUE_MAP } from '@/lib/stripe/mapper'
import type { SessionWithLineItem } from '@/lib/stripe/mapper'
import type Stripe from 'stripe'

// ── Shared fixture helpers ────────────────────────────────────────────────────

function makeSession(
  overrides: Partial<Stripe.Checkout.Session>,
): Stripe.Checkout.Session {
  return {
    id: 'cs_test_abc123',
    object: 'checkout.session',
    livemode: false,
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    payment_intent: 'pi_test_abc123',
    amount_total: 19500,
    currency: 'eur',
    customer: 'cus_test_xyz',
    customer_details: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      address: null,
      phone: null,
      tax_exempt: 'none',
      tax_ids: null,
    },
    custom_fields: [
      {
        key: 'location',
        label: { type: 'custom', custom: 'Location' },
        type: 'dropdown',
        dropdown: { options: [], value: 'east', default_value: null },
        optional: false,
        text: null,
        numeric: null,
      },
      {
        key: 'cohort',
        label: { type: 'custom', custom: 'Due date' },
        type: 'dropdown',
        dropdown: { options: [], value: 'marapr', default_value: null },
        optional: false,
        text: null,
        numeric: null,
      },
    ],
    created: 1_700_000_000,
    ...overrides,
  } as unknown as Stripe.Checkout.Session
}

// ── One-time payment session ──────────────────────────────────────────────────

describe('mapSessionToRow — one-time payment', () => {
  const input: SessionWithLineItem = {
    session: makeSession({ livemode: true }),
    lineItemDescription: 'For single parent families',
    subscription: null,
  }

  const row = mapSessionToRow(input)

  it('maps product name via switch', () => {
    expect(row.product).toBe('Fourth Trimester Program (Single parent)')
  })

  it('sets isActive=true when payment_status is paid', () => {
    expect(row.isActive).toBe(true)
  })

  it('converts amount_total from cents to euros', () => {
    expect(row.amount).toBe(195)
  })

  it('builds correct live dashboard URL', () => {
    expect(row.dashboardUrl).toContain('/payments/pi_test_abc123')
    expect(row.dashboardUrl).not.toContain('/test/')
  })

  it('is NOT flagged as test', () => {
    expect(row.isTest).toBe(false)
  })

  it('beautifies custom fields via valueMap', () => {
    const location = row.customFields.find((f) => f.label === 'Location')
    const cohort = row.customFields.find((f) => f.label === 'Due date')
    expect(location?.value).toBe('Amsterdam East')
    expect(cohort?.value).toBe('Mar/Apr')
  })

  it('sets name and email from customer_details', () => {
    expect(row.name).toBe('Jane Doe')
    expect(row.email).toBe('jane@example.com')
  })
})

// ── Subscription session ──────────────────────────────────────────────────────

describe('mapSessionToRow — subscription', () => {
  const activeSubscription = {
    id: 'sub_test_abc',
    status: 'active',
  } as unknown as Stripe.Subscription

  const cancelledSubscription = {
    id: 'sub_test_cancelled',
    status: 'canceled',
  } as unknown as Stripe.Subscription

  it('sets isActive=true for active subscription', () => {
    const row = mapSessionToRow({
      session: makeSession({ mode: 'subscription', payment_intent: null }),
      lineItemDescription: 'For multi-parent families',
      subscription: activeSubscription,
    })
    expect(row.isActive).toBe(true)
    expect(row.product).toBe('Fourth Trimester Program (Multi-parent)')
    expect(row.mode).toBe('subscription')
  })

  it('sets isActive=false for canceled subscription', () => {
    const row = mapSessionToRow({
      session: makeSession({ mode: 'subscription', payment_intent: null }),
      lineItemDescription: 'For multi-parent families',
      subscription: cancelledSubscription,
    })
    expect(row.isActive).toBe(false)
  })

  it('sets isActive=true for trialing subscription', () => {
    const row = mapSessionToRow({
      session: makeSession({ mode: 'subscription', payment_intent: null }),
      lineItemDescription: null,
      subscription: { ...activeSubscription, status: 'trialing' } as unknown as Stripe.Subscription,
    })
    expect(row.isActive).toBe(true)
  })
})

// ── Test-mode session ─────────────────────────────────────────────────────────

describe('mapSessionToRow — test mode', () => {
  it('flags isTest=true and inserts /test/ in dashboard URL', () => {
    const row = mapSessionToRow({
      session: makeSession({ livemode: false }),
      lineItemDescription: null,
      subscription: null,
    })
    expect(row.isTest).toBe(true)
    expect(row.dashboardUrl).toContain('/test/')
  })
})

// ── VALUE_MAP ─────────────────────────────────────────────────────────────────

describe('VALUE_MAP', () => {
  it('covers all expected cohort values', () => {
    const cohorts = ['janfeb', 'marapr', 'mayjun', 'julaug', 'sepoct', 'novdec']
    for (const c of cohorts) {
      expect(VALUE_MAP[c]).toBeDefined()
    }
  })

  it('covers east and west', () => {
    expect(VALUE_MAP['east']).toBe('Amsterdam East')
    expect(VALUE_MAP['west']).toBe('Amsterdam West')
  })
})
