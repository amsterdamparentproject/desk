import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      // PWA Web Share Target navigations arrive with Origin: null (opaque origin from the OS share sheet).
      // Next.js's CSRF check for Server Actions would otherwise reject these.
      allowedOrigins: ['null'],
    },
  },
  async headers() {
    return [
      {
        // Prevent browsers and CDNs from caching the share page so the PWA always
        // loads fresh JavaScript after a deployment. Without this, old cached JS
        // can still reference server action IDs from a previous build.
        source: '/share/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

// Sentry (EU region). Token and project come from env so nothing secret is
// committed. Without SENTRY_AUTH_TOKEN the build skips source-map upload.
export default withSentryConfig(
  {
    ...nextConfig,
    env: {
      ...nextConfig.env,
      // Netlify's CONTEXT is "production" | "deploy-preview" | "branch-deploy".
      NEXT_PUBLIC_SENTRY_ENVIRONMENT:
        process.env.CONTEXT || process.env.NODE_ENV || 'development',
    },
  },
  {
    org: 'amsterdam-parent-project',
    project: process.env.SENTRY_PROJECT || 'desk',
    sentryUrl: process.env.SENTRY_URL || 'https://de.sentry.io',
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
    telemetry: false,
    widenClientFileUpload: true,

    // Send browser events through our own /monitoring route so ad blockers
    // don't drop them. proxy.ts matches every path but only acts on POSTs that
    // carry a next-action header, so Sentry's tunnel requests pass through it.
    tunnelRoute: '/monitoring',

    webpack: {
      treeshake: {
        removeDebugLogging: true,
      },
    },
  }
)
