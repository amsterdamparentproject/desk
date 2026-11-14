'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

const NAV_LINKS = [
  { href: '/', label: 'Activities' },
  { href: '/finances', label: 'Finances' },
  { href: '/sources', label: 'Sources' },
  { href: '/customers', label: 'Customers' },
]

export function DeskNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="shrink-0 flex items-center justify-between gap-2 h-14 py-6 px-3 md:px-5 bg-black border-b border-black/10">
      {/* Wordmark + badge */}
      <div className="flex shrink-0 items-center gap-2.5">
        <Image
          src="/app_desk_logo.png"
          alt="Amsterdam Parent Project"
          loading="eager"
          width={30}
          height={30}
          className="rounded-sm"
        />
        <span className="hidden md:block text-2xl italic font-bold text-app-cream mr-2">
          The APP Desk
        </span>
        {isLoggedIn && (
          <span className="hidden md:block text-xs font-mono text-black bg-app-gold px-2 py-0.5 rounded-md">
            ● Secure
          </span>
        )}
      </div>

      {/* Links */}
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto md:gap-1">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap px-2.5 md:px-3.5 py-1.5 rounded-md text-[13px] md:text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-app-gold text-black'
                  : 'text-white hover:bg-app-charcoal/10'
              }`}
            >
              {label}
            </Link>
          )
        })}
        {isLoggedIn && (
          <form action={logout}>
            <button
              type="submit"
              className="ml-0 md:ml-1 whitespace-nowrap px-2 md:px-3 py-1.5 rounded-md text-[13px] md:text-sm font-medium text-white/60 hover:text-white hover:bg-app-charcoal/10 transition-colors"
            >
              Log out
            </button>
          </form>
        )}
      </div>
    </nav>
  )
}
