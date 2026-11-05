import { useId } from 'react'

/** Meeple outline in a 32×32 box; shared by the logo and public/favicon.svg. */
export const MEEPLE_PATH =
  'M16 5a3.6 3.6 0 0 1 3.6 3.6c0 1-.4 1.9-1 2.5l5.6 2.2c1.4.6 2 2.2 1.3 3.5-.5.9-1.5 1.3-2.5 1.1l-2.6-.5 2.7 6.4c.4 1-.3 2.1-1.4 2.1h-3.1L16 21.7l-2.6 4.2h-3.1c-1.1 0-1.8-1.1-1.4-2.1l2.7-6.4-2.6.5c-1 .2-2-.2-2.5-1.1-.7-1.3-.1-2.9 1.3-3.5l5.6-2.2c-.6-.6-1-1.5-1-2.5A3.6 3.6 0 0 1 16 5z'

export function LogoMark({ size = 36 }: { size?: number }) {
  const id = useId()
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d={MEEPLE_PATH} fill="#0f172a" />
      <circle cx="26" cy="6" r="2" fill="#fff" opacity="0.85" />
    </svg>
  )
}

/** Decorative hero illustration: a card, a hex tile, a die and a meeple. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 280 240" className="hero-art" aria-hidden="true">
      <g transform="rotate(-12 70 120)">
        <rect x="28" y="56" width="92" height="128" rx="12" fill="#1f2a40" stroke="rgba(255,255,255,0.14)" />
        <rect x="40" y="68" width="68" height="54" rx="6" fill="rgba(34,197,94,0.22)" />
        <rect x="40" y="132" width="52" height="7" rx="3.5" fill="rgba(255,255,255,0.2)" />
        <rect x="40" y="147" width="38" height="7" rx="3.5" fill="rgba(255,255,255,0.12)" />
      </g>
      <path
        d="M200 18l44 25v50l-44 25-44-25V43z"
        fill="rgba(245,158,11,0.16)"
        stroke="rgba(245,158,11,0.6)"
        strokeWidth="2"
      />
      <g transform="rotate(14 196 172)">
        <rect x="156" y="132" width="80" height="80" rx="18" fill="#f8fafc" />
        <circle cx="178" cy="154" r="7" fill="#0f172a" />
        <circle cx="196" cy="172" r="7" fill="#0f172a" />
        <circle cx="214" cy="190" r="7" fill="#0f172a" />
      </g>
      <g transform="translate(92 92) scale(3.2)">
        <path d={MEEPLE_PATH} fill="#22c55e" />
      </g>
    </svg>
  )
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Site favicon from boardgamegeek.com. */
export function BggMark() {
  return (
    <img
      className="source-mark"
      src={`${import.meta.env.BASE_URL}bgg-favicon.png`}
      alt=""
      width={16}
      height={16}
    />
  )
}

/** Site favicon from tesera.ru (favicon.svg). */
export function TeseraMark() {
  return (
    <img
      className="source-mark"
      src={`${import.meta.env.BASE_URL}tesera-favicon.svg`}
      alt=""
      width={16}
      height={16}
    />
  )
}

export function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" {...stroke}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

/** Waiting on other players. Hourglass, so it is not the play-time clock. */
export function DowntimeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" {...stroke}>
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  )
}

/** Four rising bars, `level` of them filled (1 = light … 4 = very heavy). */
export function ComplexityIcon({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 20 16" width="18" height="15" aria-hidden="true" className="complexity-icon">
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={i * 5 + 0.5}
          y={12 - i * 3.5}
          width="3.5"
          height={4 + i * 3.5}
          rx="1"
          className={i < level ? 'on' : 'off'}
        />
      ))}
    </svg>
  )
}
