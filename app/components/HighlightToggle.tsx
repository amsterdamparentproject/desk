'use client'

import { useState } from 'react'
import { LavaLamp } from './Lava'

type Bubble = { id: number; dx: number; dy: number; size: number; dur: number }

let burstId = 0

function makeBurst(): Bubble[] {
  return Array.from({ length: 9 }, () => ({
    id: ++burstId,
    dx: Math.round((Math.random() - 0.5) * 120),
    dy: -Math.round(50 + Math.random() * 70),
    size: Math.round(6 + Math.random() * 12),
    dur: 0.8 + Math.random() * 0.7,
  }))
}

export function HighlightToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([])

  const handleClick = () => {
    const next = !checked
    if (next) {
      setBubbles(makeBurst())
      setTimeout(() => setBubbles([]), 1700)
    }
    onChange(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      className={`relative flex items-center gap-3 rounded-2xl border-2 px-4 py-2 text-left transition-all duration-300 ${
        checked
          ? 'border-amber-400 bg-amber-50 shadow-[0_0_24px_rgba(255,191,0,0.35)]'
          : 'border-slate-200 bg-surface hover:border-amber-300'
      }`}
    >
      <span className="relative flex h-12 w-6 items-center justify-center">
        <LavaLamp
          width={22}
          height={46}
          awake={checked}
          glowOpacity={checked ? 0.9 : 0}
          label=""
        />
        {bubbles.map((b) => (
          <span
            key={b.id}
            aria-hidden="true"
            className="bubble-burst pointer-events-none absolute left-1/2 top-2 rounded-full bg-amber-300"
            style={
              {
                width: b.size,
                height: b.size,
                marginLeft: -b.size / 2,
                '--dx': `${b.dx}px`,
                '--dy': `${b.dy}px`,
                '--dur': `${b.dur}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
      <span className="flex flex-col">
        <span
          className={`text-xs font-bold md:text-sm ${checked ? 'text-amber-300' : 'text-slate-500'}`}
        >
          Highlight in newsletter
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {checked ? 'Glowing' : 'Tap to light up'}
        </span>
      </span>
    </button>
  )
}
