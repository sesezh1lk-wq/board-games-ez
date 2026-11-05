// "Bridge" experiment on real data: node --experimental-strip-types scripts/check-bridge.ts
// For a pair of games, find games that suit both: 1-hop (linked to both) and 2-hop (via one game).
import { readFileSync } from 'node:fs'
import { buildIndex, popularityDamping, positionWeight, recommend, type Data } from '../src/recommend.ts'

const data: Data = JSON.parse(readFileSync(new URL('../public/data.json', import.meta.url), 'utf-8'))
const index = buildIndex(data)
const label = (id: number) => index.byId.get(id)?.ru ?? index.byId.get(id)?.name ?? `#${id}`

const REVERSE = 0.5
const HOP2 = 0.5

/** Undirected weighted neighbours: own list counts fully, being in the other's list counts half. */
function neighbours(id: number): Map<number, number> {
  const m = new Map<number, number>()
  const bump = (k: number, v: number) => m.set(k, Math.max(m.get(k) ?? 0, v))
  for (const [t, pos] of index.out.get(id) ?? []) bump(t, positionWeight(pos))
  for (const [s, pos] of index.incoming.get(id) ?? []) bump(s, REVERSE * positionWeight(pos))
  return m
}

function reach(id: number): { one: Map<number, number>; all: Map<number, number> } {
  const one = neighbours(id)
  const all = new Map(one)
  for (const [mid, w1] of one) {
    for (const [x, w2] of neighbours(mid)) {
      if (x === id) continue
      all.set(x, (all.get(x) ?? 0) + HOP2 * w1 * w2)
    }
  }
  return { one, all }
}

const STRICT = process.argv.includes('--strict')
const MIN_BALANCE = 0.3

function bridge(a: number, b: number) {
  const ra = reach(a)
  const rb = reach(b)
  const rows: { id: number; score: number; hop1: boolean; balance: number }[] = []
  for (const [x, sa] of ra.all) {
    const sb = rb.all.get(x)
    if (!sb || x === a || x === b) continue
    const hop1 = ra.one.has(x) && rb.one.has(x)
    const balance = Math.min(sa, sb) / Math.max(sa, sb)
    if (STRICT && !hop1 && balance < MIN_BALANCE) continue
    const damping = popularityDamping(index, x)
    rows.push({
      id: x,
      score: Math.sqrt(sa * sb) * (STRICT && !hop1 ? damping ** 3 : damping),
      hop1,
      balance,
    })
  }
  rows.sort((p, q) => q.score - p.score)
  const hop1 = rows.filter((r) => r.hop1).length
  return { rows, hop1, direct: ra.one.has(b) }
}

const PAIRS: [number, number, string][] = [
  [167355, 224517, 'далёкие: кооп-хоррор + тяжёлое евро'],
  [167355, 155821, 'средние: Немезида + Иниш'],
  [174430, 266192, 'далёкие: кампания + семейная'],
  [167791, 178900, 'далёкие: евро + вечеринка'],
  [13, 30549, 'классика: Катан + Пандемия'],
  [162886, 230802, 'далёкие: кооп + абстракт'],
  [233078, 9209, 'далёкие: 4X + семейная'],
  [237182, 822, 'средние: Корни + Каркассон'],
  [316554, 295947, 'средние: Дюна + Каскадия'],
  [205637, 204583, 'далёкие: карточный кооп + лёгкая'],
  [173346, 170216, 'средние: дуэль + Кровь и Ярость'],
  [169786, 148228, 'средние: Серп + Splendor'],
  [199792, 115746, 'далёкие: Эверделл + Война Кольца'],
  [12333, 39856, 'далёкие: варгейм + вечеринка'],
  [96848, 129622, 'далёкие: тяжёлое приключение + филлер'],
  [124361, 39463, 'далёкие: Конкордия + Космик'],
  [224517, 220308, 'контроль, близкие: Brass + Гайя'],
  [266192, 199792, 'контроль, близкие: Wingspan + Эверделл'],
  [178900, 225694, 'контроль, близкие: Кодовые имена + Декодер'],
]

const summary: string[] = []
const hubs = new Map<number, number>()
for (const [a, b, note] of PAIRS) {
  if (!index.byId.has(a) || !index.byId.has(b)) {
    console.log(`\n!!! нет в базе: ${index.byId.has(a) ? '' : a} ${index.byId.has(b) ? '' : b} (${note})`)
    continue
  }
  const { rows, hop1, direct } = bridge(a, b)
  const current = recommend(index, [a, b])
  const cur2of2 = current.filter((r) => r.coveredPicks === 2).length
  const topBridge = rows.slice(0, 10).map((r) => r.id)
  const topCur = new Set(current.slice(0, 10).map((r) => r.game.id))
  const sameTop = topBridge.filter((id) => topCur.has(id)).length

  console.log(`\n=== ${label(a)} + ${label(b)} — ${note}`)
  console.log(
    `напрямую связаны: ${direct ? 'да' : 'нет'} | общих соседей (1 шаг): ${hop1} | на сайте «2 из 2»: ${cur2of2} | через 1 игру: ${rows.length} | совпадает с текущим топ-10: ${sameTop}/10`,
  )
  for (const r of rows.slice(0, 6)) {
    hubs.set(r.id, (hubs.get(r.id) ?? 0) + 1)
    console.log(
      `  ${r.hop1 ? '1 шаг ' : '2 шага'}  баланс ${r.balance.toFixed(2)}  ${label(r.id)}`,
    )
  }
  console.log(`  текущий подбор: ${current.slice(0, 4).map((r) => `${label(r.game.id)} (${r.coveredPicks}/2)`).join(', ')}`)
  summary.push(`${label(a)} + ${label(b)}\t${hop1}\t${cur2of2}\t${sameTop}/10`)
}
console.log('\nпара\tобщих 1 шаг\t«2 из 2»\tтоп-10 как сейчас')
for (const s of summary) console.log(s)
const repeated = [...hubs].filter(([, n]) => n >= 4).sort((p, q) => q[1] - p[1])
console.log(`\nигры в топ-6 у 4+ пар (из ${PAIRS.length}): ${repeated.map(([id, n]) => `${label(id)} ×${n}`).join(', ') || 'нет'}`)
