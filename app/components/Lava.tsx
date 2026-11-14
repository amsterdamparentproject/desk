'use client'

import { useId } from 'react'

/**
 * Lava lamp motif: a few pure-SVG pieces (SMIL animation + a "goo" filter), no
 * JS timers. Animation is disabled by `.lamp-anim` in globals.css when the
 * visitor prefers reduced motion.
 */

const SPLINE = '0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1'
const SPLINE_2 = '0.45 0 0.55 1;0.45 0 0.55 1'

export const LAMP_WAX = ['#ff3b4f', '#ff7a85', '#ff3b4f']

function useSvgId(prefix: string) {
  // React ids contain characters that are awkward in url(#...).
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`
}

function Goo({
  id,
  blur = 6,
  k = 18,
  offset = -7,
}: {
  id: string
  blur?: number
  k?: number
  offset?: number
}) {
  return (
    <filter
      id={id}
      x="-30%"
      y="-30%"
      width="160%"
      height="160%"
      colorInterpolationFilters="sRGB"
    >
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="b" />
      <feColorMatrix
        in="b"
        mode="matrix"
        values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${k} ${offset}`}
      />
    </filter>
  )
}

const BLOBS = [
  { cx: 46, r: 7.5, dur: 13, begin: 0, c: 1 },
  { cx: 68, r: 9.5, dur: 10, begin: 2.6, c: 2 },
  { cx: 58, r: 11.5, dur: 15, begin: 5.1, c: 0 },
  { cx: 78, r: 6.5, dur: 8, begin: 1.3, c: 1 },
  { cx: 40, r: 8.5, dur: 9, begin: 3.9, c: 2 },
]

const GLASS = 'M39 38 Q60 33 81 38 L104 184 Q60 198 16 184 Z'

/** The real lamp: tall cone cap, glass, graphite waist, silver foot. */
export function LavaLamp({
  width = 30,
  height = 62,
  awake = true,
  wax = LAMP_WAX,
  outline = '#fff8eb',
  glow = 'transparent',
  glowOpacity = 0.1,
  strokeWidth = 3,
  label = 'Lava lamp',
}: {
  width?: number
  height?: number
  awake?: boolean
  wax?: string[]
  outline?: string
  glow?: string
  glowOpacity?: number
  strokeWidth?: number
  label?: string
}) {
  const clip = useSvgId('lc')
  const goo = useSvgId('lg')
  return (
    <svg
      className="lamp-anim"
      viewBox="0 0 120 250"
      width={width}
      height={height}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clip}>
          <path d={GLASS} />
        </clipPath>
        <Goo id={goo} blur={6} />
      </defs>
      <path d={GLASS} fill={glow} fillOpacity={glowOpacity} />
      <g clipPath={`url(#${clip})`}>
        <g filter={`url(#${goo})`}>
          <rect x="8" y="164" width="104" height="44" rx="20" fill={wax[0]} />
          {awake &&
            BLOBS.map((b, i) => (
              <circle
                key={i}
                cx={b.cx}
                cy={170}
                r={b.r}
                fill={wax[b.c % wax.length]}
              >
                <animate
                  attributeName="cy"
                  values="172;125;62;112;172"
                  keyTimes="0;.28;.5;.76;1"
                  dur={`${b.dur}s`}
                  begin={`-${b.begin}s`}
                  repeatCount="indefinite"
                  calcMode="spline"
                  keySplines={SPLINE}
                />
                <animate
                  attributeName="r"
                  values={`${b.r};${b.r + 3};${b.r - 2};${b.r + 2};${b.r}`}
                  dur={`${b.dur}s`}
                  begin={`-${b.begin}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cx"
                  values={`${b.cx};${b.cx + 7};${b.cx - 6};${b.cx + 4};${b.cx}`}
                  dur={`${(b.dur * 1.3).toFixed(1)}s`}
                  begin={`-${b.begin}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
        </g>
      </g>
      <path
        d={GLASS}
        fill="none"
        stroke={outline}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <path
        d="M47 66 L57 168"
        stroke="#fff"
        strokeOpacity=".28"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* cap */}
      <path
        d="M48 5 L72 5 Q74 5 75 8 L83 39 Q60 44 37 39 L45 8 Q46 5 48 5Z"
        fill="#4a4e50"
        stroke={outline}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      {/* graphite waist */}
      <path
        d="M16 182 Q60 196 104 182 L80 214 Q60 218 40 214 Z"
        fill="#4a4e50"
        stroke={outline}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      {/* silver foot */}
      <path
        d="M40 212 Q60 218 80 212 L104 242 Q104 247 99 247 L21 247 Q16 247 16 242 Z"
        fill="#acacac"
        stroke={outline}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Three wax blobs that bob and merge. For buttons and "processing" rows. */
export function LavaSpinner({
  color = '#ffbf00',
  width = 40,
  height = 20,
  label = 'Loading',
}: {
  color?: string
  width?: number
  height?: number
  label?: string
}) {
  const goo = useSvgId('ls')
  return (
    <svg
      className="lamp-anim shrink-0"
      viewBox="0 0 54 26"
      width={width}
      height={height}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <Goo id={goo} blur={3} />
      </defs>
      <g filter={`url(#${goo})`} fill={color}>
        {[10, 27, 44].map((cx, i) => (
          <circle key={cx} cx={cx} cy={16} r={6}>
            <animate
              attributeName="cy"
              values="16;7;16"
              dur="1.2s"
              begin={`${i * 0.2}s`}
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;.5;1"
              keySplines={SPLINE_2}
            />
            <animate
              attributeName="r"
              values="6;8;6"
              dur="1.2s"
              begin={`${i * 0.2}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </g>
    </svg>
  )
}

/**
 * Full-area loader: the big lamp on a magenta glow. Shows after a short delay
 * so quick loads never flash it.
 */
export function LavaLoader({
  message = 'Warming up the wax…',
  fill = true,
  delay = 1,
}: {
  message?: string
  fill?: boolean
  /** Seconds to wait before fading in (0 = show immediately). */
  delay?: number
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fill ? 'min-h-[60vh] flex-1' : 'py-12'} flex flex-col items-center justify-center gap-5 rounded-3xl bg-lamp-glow/90 p-8 text-ink `}
      style={{ animation: `lava-fade-in .3s ease ${delay}s both` }}
    >
      <LavaLamp
        width={130}
        height={270}
        glow="#ed45df"
        glowOpacity={1}
        outline="#1d1a1b"
        strokeWidth={4}
        label="Loading"
      />
      <p className="font-display text-xl font-extrabold">{message}</p>
    </div>
  )
}

/** Tilted goo pill used for section headers (This match, Recurring, ...). */
export function GooPill({
  label,
  count,
  color = '#ffbf00',
  blob = '#e32dd4',
  tilt = -1.5,
}: {
  label: string
  count: number
  color?: string
  blob?: string
  tilt?: number
}) {
  const goo = useSvgId('lp')
  const pw = Math.round(label.length * 12.5 + 40)
  const w = pw + 34
  return (
    <div
      className="inline-block h-12 origin-left"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <svg
        className="lamp-anim"
        viewBox={`0 0 ${w} 48`}
        width={w}
        height={48}
        role="img"
        aria-label={`${label} ${count}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <Goo id={goo} blur={5} k={20} offset={-8} />
        </defs>
        <g filter={`url(#${goo})`}>
          <rect x="4" y="6" width={pw} height="36" rx="18" fill={color} />
          <circle cx={pw + 6} cy="24" r="15" fill={blob}>
            <animate
              attributeName="cx"
              values={`${pw + 6};${pw - 2};${pw + 6}`}
              dur="5s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;.5;1"
              keySplines={SPLINE_2}
            />
            <animate
              attributeName="r"
              values="14;16;14"
              dur="5s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
        <text
          x={pw / 2 + 4}
          y="30"
          textAnchor="middle"
          fontFamily="var(--font-unbounded), sans-serif"
          fontWeight="800"
          fontSize="13"
          letterSpacing="1.2"
          fill="#1d1a1b"
        >
          {label.toUpperCase()}
        </text>
        <text
          x={pw + 6}
          y="29"
          textAnchor="middle"
          fontFamily="var(--font-dm-mono), monospace"
          fontWeight="500"
          fontSize="13"
          fill="#1d1a1b"
        >
          {count}
        </text>
      </svg>
    </div>
  )
}
