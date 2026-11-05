// Sanity check of the scoring on real data: node --experimental-strip-types scripts/check-recommend.ts
import { readFileSync } from 'node:fs'
import { buildIndex, recommend, searchGames, type Data } from '../src/recommend.ts'

const data: Data = JSON.parse(readFileSync(new URL('../public/data.json', import.meta.url), 'utf-8'))
const index = buildIndex(data)
const label = (id: number) => {
  const g = index.byId.get(id)!
  return g.ru ? `${g.ru} / ${g.name}` : g.name
}

function show(title: string, picks: number[]) {
  const recs = recommend(index, picks)
  console.log(`\n=== ${title}: ${picks.map(label).join(' + ')} (results ${recs.length})`)
  for (const r of recs.slice(0, 10)) {
    const why = r.reasons
      .map((x) => `${x.kind}:${index.byId.get(x.pickId)!.name}#${x.position}`)
      .join(', ')
    console.log(
      `${String(r.match).padStart(3)}%  ${r.coveredPicks}/${picks.length}  ${label(r.game.id)}  [${why}]`,
    )
  }
}

console.log('search "немез":', searchGames(index, 'немез', new Set()).map((g) => g.ru ?? g.name))
console.log('search "inis":', searchGames(index, 'inis', new Set()).map((g) => g.ru ?? g.name))
show('two seeds', [167355, 155821])
show('non-seed pick', [381248])
show('one seed', [224517])
const before = recommend(index, [224517])
const dropped = before[0]
const after = recommend(index, [224517], [dropped.game.id])
const gone = before.filter((r) => !after.some((x) => x.game.id === r.game.id))
console.log(`\ndislike ${label(dropped.game.id)}: still listed ${after.some((r) => r.game.id === dropped.game.id)}`)
console.log(`before ${before.length} after ${after.length} removed ${gone.length}`)
console.log('removed', gone.slice(0, 8).map((r) => label(r.game.id)).join(' | '))
console.log('before', before.slice(0, 8).map((r) => label(r.game.id)).join(' | '))
console.log('after ', after.slice(0, 8).map((r) => label(r.game.id)).join(' | '))
