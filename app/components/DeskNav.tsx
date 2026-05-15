'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/',          label: 'Activities' },
  { href: '/finances',  label: 'Finances'   },
]

export function DeskNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="shrink-0 flex items-center justify-between h-14 py-6 px-5 bg-black border-b border-black/10">
      {/* Wordmark + badge */}
      <div className="flex items-center gap-2.5">
        <Image
          src="/app_desk_logo.png"
          alt="Amsterdam Parent Project"
          width={30}
          height={30}
          className="rounded-sm"
        />
        <span className="text-2xl italic font-bold text-app-cream mr-2">
          The APP Desk
        </span>
        {isLoggedIn && (
          <span className="text-xs font-mono text-black bg-app-gold px-2 py-0.5 rounded-md">
            ● Secure
          </span>
        )}
      </div>

      {/* Links */}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-app-gold text-black'
                  : 'text-white hover:bg-app-charcoal/10'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
