'use client'

import type { ReactNode } from 'react'

export type PillColor = 'blue' | 'green' | 'magenta' | 'amber'

const COLORS: Record<PillColor, { on: string; hover: string; bubble: string }> =
  {
    blue: {
      on: 'border-blue-400 bg-blue-400 text-ink shadow-[0_0_16px_rgba(68,157,209,0.55),3px_3px_0_#1b5f87]',
      hover: 'hover:border-blue-400 hover:text-blue-300',
      bubble: 'bg-blue-300',
    },
    green: {
      on: 'border-green-400 bg-green-400 text-ink shadow-[0_0_16px_rgba(9,188,138,0.55),3px_3px_0_#186247]',
      hover: 'hover:border-green-400 hover:text-green-300',
      bubble: 'bg-green-300',
    },
    magenta: {
      on: 'border-violet-400 bg-violet-400 text-ink shadow-[0_0_16px_rgba(237,69,223,0.55),3px_3px_0_#8f1488]',
      hover: 'hover:border-violet-400 hover:text-violet-300',
      bubble: 'bg-violet-300',
    },
    amber: {
      on: 'border-app-gold bg-app-gold text-ink shadow-[0_0_16px_rgba(255,191,0,0.55),3px_3px_0_#9a5206]',
      hover: 'hover:border-app-gold hover:text-amber-300',
      bubble: 'bg-amber-300',
    },
  }

// A little variety so a row of selected pills does not look stamped out.
const TILTS = ['-1.5deg', '1.2deg', '-1deg', '1.6deg', '-0.6deg']
const BUBBLE_DX = ['-10px', '2px', '12px']

/**
 * Chunky, tappable pill. Selecting one pops it (a springy squash and stretch),
 * tilts it a touch, lights it up and lets a few wax bubbles float off. All CSS,
 * and the motion switches off for people who prefer reduced motion.
 */
export function Pill({
  active,
  onClick,
  onBlur,
  color = 'blue',
  index = 0,
  size = 'md',
  role,
  children,
}: {
  active: boolean
  onClick: () => void
  onBlur?: () => void
  color?: PillColor
  index?: number
  size?: 'sm' | 'md'
  role?: 'radio' | 'checkbox'
  children: ReactNode
}) {
  const c = COLORS[color]
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? active : undefined}
      aria-pressed={role ? undefined : active}
      onClick={onClick}
      onBlur={onBlur}
      style={{ ['--tilt' as string]: TILTS[index % TILTS.length] }}
      className={`relative rounded-full border-2 font-display font-bold transition-[colors,box-shadow] duration-150 active:scale-95 ${
        size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-[11px]'
      } ${
        active
          ? `pill-on ${c.on}`
          : `border-slate-200 bg-base text-slate-500 ${c.hover} hover:-translate-y-px`
      }`}
    >
      {children}
      {active &&
        BUBBLE_DX.map((dx, i) => (
          <span
            key={i}
            aria-hidden
            className={`pill-bubble pointer-events-none absolute top-0 h-1.5 w-1.5 rounded-full ${c.bubble}`}
            style={{
              left: `${25 + i * 25}%`,
              animationDelay: `${i * 80}ms`,
              ['--dx' as string]: dx,
            }}
          />
        ))}
    </button>
  )
}
