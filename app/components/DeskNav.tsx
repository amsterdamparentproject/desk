'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { LavaLamp } from './Lava'

const NAV_LINKS = [
  { href: '/', label: 'Activities' },
  { href: '/finances', label: 'Finances' },
  { href: '/sources', label: 'Sources' },
  { href: '/customers', label: 'Customers' },
]

export function DeskNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="shrink-0 flex items-center justify-between gap-2 h-16 px-3 md:px-6 bg-surface border-b-2 border-blue-400 shadow-[0_6px_30px_rgba(68,157,209,0.2)]">
      {/* Wordmark + badge */}
      <div className="flex shrink-0 items-center gap-2.5">
        <LavaLamp
          width={22}
          height={46}
          outline="#449dd1"
          strokeWidth={5}
          label="The APP Desk"
        />
        <span className="hidden md:block font-display text-xl font-extrabold text-blue-400 [text-shadow:0_0_18px_rgba(68,157,209,0.6)] mr-2">
          THE APP DESK
        </span>
        {isLoggedIn && (
          <span className="hidden md:block text-xs font-mono font-medium text-ink bg-app-gold px-2 py-0.5 rounded-full shadow-[0_0_14px_rgba(255,191,0,0.4)]">
            ● Secure
          </span>
        )}
      </div>

      {/* Links */}
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto md:gap-2">
        {NAV_LINKS.map(({ href, label }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap px-3 md:px-4 py-2 rounded-xl border-2 font-display text-[11px] md:text-xs font-bold transition-colors ${
                isActive
                  ? 'border-lamp-glow bg-lamp-glow text-ink shadow-[0_0_24px_rgba(227,45,212,0.45)]'
                  : 'border-slate-200 text-white hover:border-slate-400'
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
              className="ml-0 md:ml-1 whitespace-nowrap px-2 md:px-3 py-2 rounded-xl text-[13px] md:text-sm font-medium text-slate-500 hover:text-white hover:bg-slate-100 transition-colors"
            >
              Log out
            </button>
          </form>
        )}
      </div>
    </nav>
  )
}
