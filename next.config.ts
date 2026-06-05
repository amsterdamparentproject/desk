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
}

export default nextConfig
