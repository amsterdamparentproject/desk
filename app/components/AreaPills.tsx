'use client'

import { AREAS } from '@/lib/parse/schema'
import { Pill } from './Pills'

type Area = (typeof AREAS)[number]

// Display order: the compass areas first, then the two non-places.
const AREA_ORDER: Area[] = [
  'West',
  'East',
  'North',
  'Center',
  'South',
  'Everywhere',
  'Online',
]

/**
 * Single-select area picker as tappable pills. Tapping the selected pill
 * clears it. `onChange` fires on every tap, so callers can save right away.
 */
export function AreaPills({
  value,
  onChange,
  compact = false,
}: {
  value: string | null | undefined
  onChange: (area: string | null) => void
  compact?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Area" className="flex flex-wrap gap-2">
      {AREA_ORDER.map((area, i) => {
        const active = value === area
        return (
          <Pill
            key={area}
            role="radio"
            color="green"
            index={i}
            size={compact ? 'sm' : 'md'}
            active={active}
            onClick={() => onChange(active ? null : area)}
          >
            {area}
          </Pill>
        )
      })}
    </div>
  )
}
