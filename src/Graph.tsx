import { useMemo, useState } from 'react'
import { MEEPLE_PATH } from './Icons'
import type { Game, Index, Recommendation } from './recommend'

type Node = {
  id: number
  label: string
  pick: boolean
  match: number
  complexity: string | null
  minutes: number | null
  cellCount: number
  /** 0 = самая близкая фишка в клетке */
  labelRank: number
  x: number
  y: number
}
type Link = {
  source: Node
  target: Node
  toPick: boolean
}

const W = 760
const H = 560
const LEFT = 102
const TOP = 44
const RIGHT = 18
const BOTTOM = 16
const TIME_BANDS = [
  { max: 60, label: 'до 1 ч' },
  { max: 90, label: '1–1,5 ч' },
  { max: 120, label: '1,5–2 ч' },
  { max: Infinity, label: '2 ч+' },
]
const COMP_BANDS = [
  { key: 'легкая', label: 'легкая', tint: 'rgba(34,197,94,0.07)' },
  { key: 'средняя', label: 'средняя', tint: 'rgba(56,189,248,0.06)' },
  { key: 'сложная', label: 'сложная', tint: 'rgba(245,158,11,0.07)' },
  { key: 'очень сложная', label: 'оч. сложная', tint: 'rgba(248,113,113,0.07)' },
]

export function Graph({
  index,
  picks,
  results,
  onSelect,
  selectedId,
}: {
  index: Index
  picks: number[]
  results: Recommendation[]
  onSelect: (id: number) => void
  selectedId: number | null
}) {
  const [hover, setHover] = useState<number | null>(null)

  const { nodes, links, rows, cols, tints } = useMemo(() => {
    const pickSet = new Set(picks)
    const gameOf = (id: number) => index.byId.get(id)
    const nodes: Node[] = [
      ...picks.map((id) => nodeFrom(id, gameOf(id), true, 100, index)),
      ...results.map((r) => nodeFrom(r.game.id, r.game, false, r.match, index)),
    ]
    const rows = COMP_BANDS.map((b) => b.label)
    const tints = COMP_BANDS.map((b) => b.tint)
    const cols = TIME_BANDS.map((b) => b.label)
    if (nodes.some((n) => compIndex(n.complexity) < 0)) {
      rows.push('не указана')
      tints.push('rgba(255,255,255,0.03)')
    }
    if (nodes.some((n) => timeIndex(n.minutes) < 0)) cols.push('н/д')

    const nRows = rows.length
    const nCols = cols.length
    const plotW = W - LEFT - RIGHT
    const plotH = H - TOP - BOTTOM
    const groups = new Map<string, Node[]>()
    for (const n of nodes) {
      const col = axisIndex(timeIndex(n.minutes), nCols)
      const row = axisIndex(compIndex(n.complexity), nRows)
      const key = `${col}:${row}`
      const list = groups.get(key) ?? []
      list.push(n)
      groups.set(key, list)
    }
    for (const [key, list] of groups) {
      const [col, row] = key.split(':').map(Number)
      const box = {
        x: LEFT + (plotW * col) / nCols,
        y: TOP + (plotH * row) / nRows,
        w: plotW / nCols,
        h: plotH / nRows,
      }
      list.sort((a, b) => Number(b.pick) - Number(a.pick) || b.match - a.match)
      const across = Math.ceil(Math.sqrt(list.length))
      const down = Math.ceil(list.length / across)
      const padX = 14
      const padY = 16
      list.forEach((n, i) => {
        n.cellCount = list.length
        n.labelRank = i
        const c = i % across
        const r = Math.floor(i / across)
        n.x = box.x + padX + ((box.w - padX * 2) * (c + 0.5)) / across
        n.y = box.y + padY + ((box.h - padY * 2) * (r + 0.5)) / down
      })
    }

    const byId = new Map(nodes.map((n) => [n.id, n]))
    const seen = new Set<string>()
    const links: Link[] = []
    for (const n of nodes) {
      for (const [tid] of index.out.get(n.id) ?? []) {
        const other = byId.get(tid)
        if (!other || tid === n.id) continue
        const key = n.id < tid ? `${n.id}-${tid}` : `${tid}-${n.id}`
        if (seen.has(key)) continue
        seen.add(key)
        links.push({ source: n, target: other, toPick: pickSet.has(n.id) || pickSet.has(tid) })
      }
    }
    return { nodes, links, rows, cols, tints }
  }, [index, picks, results])

  const focus = hover ?? selectedId
  const neighbours = useMemo(() => {
    const s = new Set<number>()
    if (focus == null) return s
    for (const l of links) {
      if (l.source.id === focus) s.add(l.target.id)
      if (l.target.id === focus) s.add(l.source.id)
    }
    return s
  }, [focus, links])

  if (!picks.length) return null

  return (
    <figure className="graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Карта связей: по вертикали сложность, по горизонтали время партии">
        <Board rows={rows} cols={cols} tints={tints} />
        {links.map((l, i) => {
          const on = focus != null && (l.source.id === focus || l.target.id === focus)
          if (!l.toPick && !on) return null
          return (
            <g key={i} className={on ? 'edge on' : focus != null ? 'edge dim' : 'edge'}>
              <line className="track" x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} />
              <line className="route" x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} />
            </g>
          )
        })}
        {nodes.map((n) => {
          const dim = focus != null && n.id !== focus && !neighbours.has(n.id)
          const showLabel =
            n.id === focus ||
            (focus != null && neighbours.has(n.id)) ||
            n.pick ||
            (n.labelRank === 0 && n.cellCount === 1)
          const r = radius(n)
          const facts = `${n.complexity ?? 'сложность не указана'}, ${formatTime(n.minutes)}`
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              className={`node ${n.pick ? 'pick' : ''} ${dim ? 'dim' : ''} ${n.id === selectedId ? 'selected' : ''}`}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => !n.pick && onSelect(n.id)}
              tabIndex={n.pick ? -1 : 0}
              onKeyDown={(e) => e.key === 'Enter' && !n.pick && onSelect(n.id)}
              role={n.pick ? undefined : 'button'}
              aria-label={n.pick ? `Ваша игра ${n.label}, ${facts}` : `${n.label}, совпадение ${n.match}%, ${facts}`}
            >
              <title>{n.pick ? `${n.label} — ${facts}` : `${n.label} — ${n.match}%, ${facts}`}</title>
              {n.pick ? (
                <>
                  <ellipse className="stand" cx="0" cy="9" rx="13" ry="4" />
                  <path className="meeple" d={MEEPLE_PATH} transform={`translate(-16 -20) scale(${n.cellCount > 6 ? 0.62 : 0.82})`} />
                </>
              ) : (
                <>
                  <polygon className="token" points={hexPoints(r)} />
                  <polygon className="pip" points={hexPoints(r * 0.55)} opacity={0.28 + (n.match / 100) * 0.72} />
                </>
              )}
              <circle className="focus-ring" r={n.pick ? 18 : r + 5} />
              {showLabel && <text y={n.pick ? -16 : -(r + 4)}>{n.label}</text>}
            </g>
          )
        })}
      </svg>
      <figcaption>
        <span className="legend-item">
          <svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true">
            <path d={MEEPLE_PATH} fill="#22c55e" />
          </svg>
          ваши игры
        </span>
        <span className="legend-item">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <polygon points={hexPoints(10)} transform="translate(12 12)" fill="#f59e0b" />
          </svg>
          рекомендации, размер фишки — совпадение
        </span>
        <span className="legend-item">
          <span className="legend-line" />
          по вертикали сложность, по горизонтали время партии. Наведите на фишку, чтобы увидеть связи,
          нажмите — откроется карточка.
        </span>
      </figcaption>
    </figure>
  )
}

function Board({ rows, cols, tints }: { rows: string[]; cols: string[]; tints: string[] }) {
  const plotW = W - LEFT - RIGHT
  const plotH = H - TOP - BOTTOM
  const cw = plotW / cols.length
  const rh = plotH / rows.length
  return (
    <g className="board" aria-hidden="true">
      <defs>
        <radialGradient id="ez-felt" cx="50%" cy="42%" r="68%">
          <stop offset="0%" stopColor="#1c2b3d" />
          <stop offset="100%" stopColor="#0d1422" />
        </radialGradient>
        <clipPath id="ez-board-clip">
          <rect width={W} height={H} rx="16" />
        </clipPath>
      </defs>
      <g clipPath="url(#ez-board-clip)">
        <rect width={W} height={H} fill="url(#ez-felt)" />
        {rows.map((_, i) => (
          <rect key={`row${i}`} x={LEFT} y={TOP + rh * i} width={plotW} height={rh} fill={tints[i]} />
        ))}
        <rect x={LEFT} y={TOP} width={plotW} height={plotH} className="zone-line" fill="none" />
        {cols.slice(1).map((_, i) => (
          <line key={`vx${i}`} className="zone-line" x1={LEFT + cw * (i + 1)} y1={TOP} x2={LEFT + cw * (i + 1)} y2={TOP + plotH} />
        ))}
        {rows.slice(1).map((_, i) => (
          <line key={`hy${i}`} className="zone-line" x1={LEFT} y1={TOP + rh * (i + 1)} x2={LEFT + plotW} y2={TOP + rh * (i + 1)} />
        ))}
      </g>
      <rect x="12" y="12" width={W - 24} height={H - 24} rx="12" className="board-frame" />
      <path className="board-corner" d="M28 16H16V28" />
      <path className="board-corner" d={`M${W - 28} 16H${W - 16}V28`} />
      <path className="board-corner" d={`M16 ${H - 28}V${H - 16}H28`} />
      <path className="board-corner" d={`M${W - 16} ${H - 28}V${H - 16}H${W - 28}`} />
      {cols.map((label, i) => (
        <text key={label} className="zone-label time" x={LEFT + cw * (i + 0.5)} y={28} textAnchor="middle">
          {label}
        </text>
      ))}
      {rows.map((label, i) => (
        <text key={label} className="zone-label" x={LEFT - 10} y={TOP + rh * (i + 0.5) + 4} textAnchor="end">
          {label}
        </text>
      ))}
    </g>
  )
}

function nodeFrom(id: number, game: Game | undefined, pick: boolean, match: number, index: Index): Node {
  return {
    id,
    label: shortName(index, id),
    pick,
    match,
    complexity: game?.complexity ?? null,
    minutes: minutesOf(game),
    cellCount: 1,
    labelRank: 0,
    x: W / 2,
    y: H / 2,
  }
}

function axisIndex(index: number, length: number) {
  return index < 0 ? length - 1 : index
}

function timeIndex(minutes: number | null) {
  if (minutes == null) return -1
  if (minutes <= 60) return 0
  if (minutes <= 90) return 1
  if (minutes <= 120) return 2
  return 3
}

function compIndex(complexity: string | null) {
  if (!complexity) return -1
  return COMP_BANDS.findIndex((b) => b.key === complexity)
}

function minutesOf(game: Game | undefined) {
  const t = game?.time
  if (!t) return null
  const [a, b] = t
  if (typeof a !== 'number' && typeof b !== 'number') return null
  if (typeof a !== 'number') return b
  if (typeof b !== 'number') return a
  return (a + b) / 2
}

function formatTime(minutes: number | null) {
  const i = timeIndex(minutes)
  return i < 0 ? 'время не указано' : TIME_BANDS[i].label
}

function hexPoints(r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

function radius(n: Node) {
  const base = n.pick ? 16 : 7 + (n.match / 100) * 8
  if (n.cellCount >= 9) return Math.min(base, 9)
  if (n.cellCount >= 5) return Math.min(base, 11)
  return base
}

function shortName(index: Index, id: number) {
  const g = index.byId.get(id)
  const name = g?.ru ?? g?.name ?? String(id)
  return name.length > 22 ? name.slice(0, 21) + '…' : name
}
