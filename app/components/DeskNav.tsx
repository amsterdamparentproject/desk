'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/',          label: 'Activities' },
  { href: '/finances',  label: 'Finances'   },
]

export function DeskNav() {
  const pathname = usePathname()

  return (
    <nav className="shrink-0 flex items-center justify-between h-14 px-5 bg-app-cream border-b border-app-charcoal/10">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5">
        <Image
          src="/app_logo.png"
          alt="Amsterdam Parent Project"
          width={30}
          height={30}
          className="rounded-sm"
        />
        <span className="text-sm font-bold tracking-tight text-app-charcoal">
          APP Desk
        </span>
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
                  ? 'bg-app-charcoal text-white'
                  : 'text-app-charcoal/70 hover:bg-app-charcoal/10'
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
