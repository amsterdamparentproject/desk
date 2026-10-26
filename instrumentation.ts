import * as Sentry from '@sentry/nextjs'

export async function register() {
  // proxy.ts runs on the Node runtime in Next 16, so no edge config is needed.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
}

// Reports errors from server components, route handlers and server actions.
export const onRequestError = Sentry.captureRequestError
