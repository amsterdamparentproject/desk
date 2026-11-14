'use client'

import { useId } from 'react'

/**
 * Two-option toggle ("Use AI" / "No AI") with a blob of wax that slides under
 * the chosen side. A slower trailing blob goes through a goo filter so the wax
 * stretches as it moves. CSS transitions only; off for reduced motion.
 */
export function GooToggle({
  checked,
  onChange,
  onLabel,
  offLabel,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  onLabel: string
  offLabel: string
}) {
  const id = useId().replace(/:/g, '')
  const wax = checked ? '#ffbf00' : '#7d7773'

  return (
    <div
      role="radiogroup"
      className={`relative grid h-14 grid-cols-2 rounded-full border-2 bg-base transition-colors duration-300 motion-reduce:transition-none ${
        checked
          ? 'border-app-gold/70 shadow-[0_0_22px_rgba(255,191,0,0.3)]'
          : 'border-slate-200'
      }`}
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id={id}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
            <feColorMatrix
              in="b"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
            />
          </filter>
        </defs>
      </svg>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1.5"
        style={{ filter: `url(#${id})` }}
      >
        <span
          className="absolute inset-y-0 w-1/2 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: checked ? 0 : '50%', background: wax }}
        />
        <span
          className="absolute inset-y-1.5 w-[44%] rounded-full transition-all duration-500 ease-in-out motion-reduce:transition-none"
          style={{
            left: checked ? '3%' : '53%',
            background: wax,
            transitionDelay: '70ms',
          }}
        />
      </span>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={() => onChange(true)}
        className={`relative z-10 rounded-full font-display text-sm font-bold transition-colors ${
          checked ? 'text-ink' : 'text-slate-500'
        }`}
      >
        {onLabel}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!checked}
        onClick={() => onChange(false)}
        className={`relative z-10 rounded-full font-display text-sm font-bold transition-colors ${
          checked ? 'text-slate-500' : 'text-ink'
        }`}
      >
        {offLabel}
      </button>
    </div>
  )
}
