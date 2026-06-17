import type { NextConfig } from 'next'

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

export default nextConfig
