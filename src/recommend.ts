export type Game = {
  id: number
  name: string
  ru: string | null
  rank: number | null
  /** BGG average rating, the score next to the game on the browse list. */
  rating?: number
  /** BGG geek rating (bayesian). The browse rank is ordered by this. */
  geek?: number
  /** Tesera «Рейтинг Тесеры» (n10), or the plain average when n10 is empty. */
  tesera?: number
  teseraAlias?: string
  players: string | null
  min: number | null
  max: number | null
  weight: number | null
  complexity: string | null
  types: string[]
  settings: string[]
  image?: string
  /** Play time in minutes, [min, max]. */
  time?: [number, number]
  /** Waiting on other players: Низкий … Очень высокий. Filled for part of the top list. */
  downtime?: string
  /** Short blurb, Russian when the base has it, otherwise English. */
  about?: string
  /** Player-written pluses, sentences separated by semicolons. */
  pros?: string
  /** Player-written minuses, sentences separated by semicolons. */
  cons?: string
}

export type Data = {
  games: Game[]
  recs: Record<string, [number, number][]>
}

/** How a picked game is linked to a recommended one. */
export type Reason = {
  pickId: number
  /** direct: pick's BGG list contains the game; reverse: game's list contains the pick;
   *  proxy: pick has no list, the game comes from a list that contains the pick. */
  kind: 'direct' | 'reverse' | 'proxy'
  position: number
  viaId?: number
}

export type Recommendation = {
  game: Game
  score: number
  match: number
  reasons: Reason[]
  coveredPicks: number
}

export type Index = {
  byId: Map<number, Game>
  out: Map<number, [number, number][]>
  incoming: Map<number, [number, number][]>
  sourceCount: number
}

const REVERSE_FACTOR = 0.5
const PROXY_FACTOR = 0.35
/** A dislike nudges the disliked game's own list down. It does not erase them. */
const DISLIKE_FACTOR = 0.45

export function buildIndex(data: Data): Index {
  const byId = new Map(data.games.map((g) => [g.id, g]))
  const out = new Map<number, [number, number][]>()
  const incoming = new Map<number, [number, number][]>()
  for (const [src, list] of Object.entries(data.recs)) {
    const sid = Number(src)
    out.set(sid, list)
    for (const [tid, pos] of list) {
      if (!incoming.has(tid)) incoming.set(tid, [])
      incoming.get(tid)!.push([sid, pos])
    }
  }
  return { byId, out, incoming, sourceCount: out.size }
}

/** Higher list positions matter more, but position 20 still counts. */
export function positionWeight(position: number): number {
  return 1 / Math.sqrt(Math.max(position, 1))
}

/**
 * Damps games that BGG recommends for almost everything (Dune: Imperium is in 75 of 300 lists).
 * 1.0 for a game in one list, ~0.53 for a game in 75 lists.
 */
export function popularityDamping(index: Index, gameId: number): number {
  const indeg = index.incoming.get(gameId)?.length ?? 0
  if (indeg === 0) return 1
  const n = index.sourceCount
  return Math.sqrt(Math.log(1 + n / indeg) / Math.log(1 + n))
}

export function recommend(index: Index, pickIds: number[], dislikeIds: number[] = []): Recommendation[] {
  if (pickIds.length === 0) return []
  const blocked = new Set([...pickIds, ...dislikeIds])
  const liked = collectScores(index, pickIds, blocked)
  const disliked = collectDirectScores(index, dislikeIds, blocked)

  const results: Recommendation[] = []
  for (const [gameId, { score, reasons }] of liked) {
    const raw = score - DISLIKE_FACTOR * (disliked.get(gameId) ?? 0)
    if (raw <= 0) continue
    const covered = new Set(reasons.map((r) => r.pickId)).size
    // A game backed by every pick beats one backed by a single pick, even a strong one.
    const coverage = covered / pickIds.length
    results.push({
      game: index.byId.get(gameId)!,
      score: raw * popularityDamping(index, gameId) * coverage,
      match: 0,
      reasons: compactReasons(reasons),
      coveredPicks: covered,
    })
  }
  results.sort((a, b) => b.score - a.score)
  const best = results[0]?.score || 1
  for (const r of results) r.match = Math.max(1, Math.round((100 * r.score) / best))
  return results
}

/** Neighbours on the seed's own recommendation list, without reverse links. */
function collectDirectScores(index: Index, seedIds: number[], blocked: Set<number>): Map<number, number> {
  const acc = new Map<number, number>()
  for (const seedId of seedIds) {
    for (const [targetId, position] of index.out.get(seedId) ?? []) {
      if (blocked.has(targetId) || !index.byId.has(targetId)) continue
      acc.set(targetId, (acc.get(targetId) ?? 0) + positionWeight(position))
    }
  }
  return acc
}

function collectScores(
  index: Index,
  seedIds: number[],
  blocked: Set<number>,
): Map<number, { score: number; reasons: Reason[] }> {
  const acc = new Map<number, { score: number; reasons: Reason[] }>()
  const add = (gameId: number, value: number, reason: Reason) => {
    if (blocked.has(gameId) || !index.byId.has(gameId)) return
    const cur = acc.get(gameId) ?? { score: 0, reasons: [] }
    cur.score += value
    cur.reasons.push(reason)
    acc.set(gameId, cur)
  }

  for (const pickId of seedIds) {
    const own = index.out.get(pickId)
    const into = index.incoming.get(pickId) ?? []
    if (own) {
      for (const [tid, pos] of own) {
        add(tid, positionWeight(pos), { pickId, kind: 'direct', position: pos })
      }
    } else {
      const proxyTotal = into.reduce((s, [, pos]) => s + positionWeight(pos), 0) || 1
      for (const [sid, posOfPick] of into) {
        const share = positionWeight(posOfPick) / proxyTotal
        for (const [tid, pos] of index.out.get(sid) ?? []) {
          add(tid, PROXY_FACTOR * share * positionWeight(pos), {
            pickId,
            kind: 'proxy',
            position: pos,
            viaId: sid,
          })
        }
      }
    }
    for (const [sid, pos] of into) {
      add(sid, REVERSE_FACTOR * positionWeight(pos), { pickId, kind: 'reverse', position: pos })
    }
  }
  return acc
}

/** Keep the strongest reason per pick and kind so cards stay readable. */
function compactReasons(reasons: Reason[]): Reason[] {
  const best = new Map<string, Reason>()
  for (const r of reasons) {
    const key = `${r.pickId}:${r.kind}`
    const cur = best.get(key)
    if (!cur || r.position < cur.position) best.set(key, r)
  }
  const order = { direct: 0, reverse: 1, proxy: 2 }
  return [...best.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.position - b.position)
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function searchGames(index: Index, query: string, exclude: Set<number>, limit = 8): Game[] {
  const q = normalize(query)
  if (!q) return []
  const hits: { g: Game; rank: number }[] = []
  for (const g of index.byId.values()) {
    if (exclude.has(g.id)) continue
    const names = [normalize(g.name), g.ru ? normalize(g.ru) : '']
    let tier = -1
    if (names.some((n) => n === q)) tier = 0
    else if (names.some((n) => n.startsWith(q))) tier = 1
    else if (names.some((n) => n.split(' ').some((w) => w.startsWith(q)))) tier = 2
    else if (names.some((n) => n.includes(q))) tier = 3
    if (tier >= 0) hits.push({ g, rank: tier * 1e6 + (g.rank != null && g.rank > 0 ? g.rank : 5e5) })
  }
  hits.sort((a, b) => a.rank - b.rank)
  return hits.slice(0, limit).map((h) => h.g)
}

export const MANY_PLAYERS = 6

export type Filters = {
  /** MANY_PLAYERS means "6 and more". */
  players: number | null
  complexity: Set<string>
  types: Set<string>
  settings: Set<string>
  downtime: Set<string>
}

export function passesFilters(g: Game, f: Filters): boolean {
  if (f.players != null) {
    if (g.min == null || g.max == null) return false
    if (f.players >= MANY_PLAYERS ? g.max < MANY_PLAYERS : f.players < g.min || f.players > g.max) {
      return false
    }
  }
  if (f.complexity.size && (!g.complexity || !f.complexity.has(g.complexity))) return false
  if (f.types.size && !g.types.some((t) => f.types.has(t))) return false
  if (f.settings.size && !g.settings.some((s) => f.settings.has(s))) return false
  if (f.downtime.size && (!g.downtime || !f.downtime.has(g.downtime))) return false
  return true
}
