// lib/stripe/client.ts
// Server-only Stripe singleton. Never import this from client components.
import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

// Pinned on purpose, so a Stripe SDK upgrade never silently changes the API
// version this app talks to. The cast keeps the pin compiling across SDK majors
// (the SDK types only accept the newest version string). Move to a newer API
// version deliberately, after reading Stripe's API changelog.
const STRIPE_API_VERSION = '2026-05-27.dahlia' as unknown as NonNullable<
  ConstructorParameters<typeof Stripe>[1]
>['apiVersion']

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: STRIPE_API_VERSION,
})
