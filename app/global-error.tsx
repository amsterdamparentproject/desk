'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Last-resort error boundary (replaces the whole document). Branded error pages
 * are a separate roadmap item; this exists so client render errors reach Sentry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang='en'>
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <h1>Something went wrong</h1>
        <p>Sorry, an unexpected error occurred. Please try again.</p>
        {error?.digest && <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Reference: {error.digest}</p>}
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  )
}
