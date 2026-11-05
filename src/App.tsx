import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './App.css'
import { Graph } from './Graph'
import { BggMark, ClockIcon, ComplexityIcon, DowntimeIcon, HeroArt, LogoMark, PlayersIcon, TeseraMark } from './Icons'
import {
  MANY_PLAYERS,
  buildIndex,
  passesFilters,
  recommend,
  normalize,
  searchGames,
  type Data,
  type Filters,
  type Game,
  type Index,
  type Recommendation,
} from './recommend'

const MAX_PICKS = 15
const PAGE = 20
const CATALOG_PAGE = 40
const GRAPH_SIZE = 25
const COMPLEXITY = ['легкая', 'средняя', 'сложная', 'очень сложная']
const DOWNTIME = ['Низкий', 'Низкий–средний', 'Средний', 'Средний–высокий', 'Высокий', 'Очень высокий']
const TIME_BANDS = ['до 1 ч', '1–1,5 ч', '1,5–2 ч', '2 ч+'] as const
const PLAYER_OPTIONS = [1, 2, 3, 4, 5, MANY_PLAYERS]

function readIds(param: string): number[] {
  const raw = new URLSearchParams(location.search).get(param) ?? ''
  return raw
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_PICKS)
}

export default function App() {
  const [index, setIndex] = useState<Index | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`data.json: HTTP ${r.status}`)
        return r.json() as Promise<Data>
      })
      .then((d) => setIndex(buildIndex(d)))
      .catch((e) => setError(String(e)))
  }, [])

  if (error) return <main className="shell"><p className="error">Не удалось загрузить базу: {error}</p></main>
  if (!index) return <main className="shell"><p className="muted">Загружаю базу игр…</p></main>
  return <Finder index={index} />
}

function usePage(): 'home' | 'games' {
  const [page, setPage] = useState<'home' | 'games'>(() => (location.hash === '#games' ? 'games' : 'home'))
  useEffect(() => {
    const sync = () => setPage(location.hash === '#games' ? 'games' : 'home')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return page
}

function Finder({ index }: { index: Index }) {
  const page = usePage()
  const [picks, setPicks] = useState<number[]>(() => readIds('g').filter((id) => index.byId.has(id)))
  const [dislikes, setDislikes] = useState<number[]>(() => {
    const liked = new Set(readIds('g'))
    return readIds('no').filter((id) => index.byId.has(id) && !liked.has(id))
  })
  const [filters, setFilters] = useState<Filters>({
    players: null,
    complexity: new Set(),
    types: new Set(),
    settings: new Set(),
    downtime: new Set(),
  })
  const [view, setView] = useState<'list' | 'graph'>('list')
  const [shown, setShown] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const detail = detailId != null ? index.byId.get(detailId) ?? null : null

  useEffect(() => {
    const url = new URL(location.href)
    if (picks.length) url.searchParams.set('g', picks.join(','))
    else url.searchParams.delete('g')
    if (dislikes.length) url.searchParams.set('no', dislikes.join(','))
    else url.searchParams.delete('no')
    history.replaceState(null, '', url)
  }, [picks, dislikes])

  const all = useMemo(() => recommend(index, picks, dislikes), [index, picks, dislikes])
  const filtered = useMemo(() => all.filter((r) => passesFilters(r.game, filters)), [all, filters])
  const typeOptions = useMemo(() => topLabels(all, (g) => g.types, 14), [all])
  const settingOptions = useMemo(() => topLabels(all, (g) => g.settings, 14), [all])
  const stats = useMemo(
    () => ({
      games: index.byId.size,
      sources: index.sourceCount,
      edges: [...index.out.values()].reduce((s, list) => s + list.length, 0),
    }),
    [index],
  )
  const activeFilters =
    (filters.players != null ? 1 : 0) +
    filters.complexity.size +
    filters.types.size +
    filters.settings.size +
    filters.downtime.size

  const updatePicks = (fn: (p: number[]) => number[]) => {
    setPicks(fn)
    setShown(PAGE)
    setSelectedId(null)
  }
  const addPick = (id: number) => {
    updatePicks((p) => (p.includes(id) || p.length >= MAX_PICKS ? p : [...p, id]))
    setDislikes((d) => d.filter((x) => x !== id))
  }
  const removePick = (id: number) => updatePicks((p) => p.filter((x) => x !== id))
  const dislike = (id: number) => {
    setDislikes((d) => (d.includes(id) ? d : [...d, id].slice(0, MAX_PICKS)))
    setShown(PAGE)
    setSelectedId(null)
  }
  const undislike = (id: number) => {
    setDislikes((d) => d.filter((x) => x !== id))
    setShown(PAGE)
  }

  useEffect(() => {
    document.title = page === 'games' ? 'Все игры — ez board game' : 'ez board game — настольные игры, которые вам понравятся'
  }, [page])

  const selectFromGraph = (id: number) => {
    setSelectedId(id)
    const pos = filtered.findIndex((r) => r.game.id === id)
    if (pos >= shown) setShown(pos + 1)
    setView('list')
    requestAnimationFrame(() => document.getElementById(`rec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="ez board game — на главную">
          <LogoMark size={34} />
          <span className="wordmark">
            <b>ez</b> board game
          </span>
        </a>
        <nav className="nav" aria-label="Разделы">
          <a href={import.meta.env.BASE_URL} aria-current={page === 'home' ? 'page' : undefined}>
            Подбор
          </a>
          <a href="#games" aria-current={page === 'games' ? 'page' : undefined}>
            Все игры
          </a>
        </nav>
      </header>

      {page === 'games' ? (
        <Catalog index={index} onOpen={setDetailId} />
      ) : (
      <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Подбор настольных игр</p>
          <h1 id="hero-title">
            Настольные игры, которые <span className="grad">вам понравятся</span>
          </h1>
          <p className="lead">
            Отметьте игры, которые вам понравились, — подберём похожие и покажем, насколько каждая совпадает с вашим
            вкусом.
          </p>
          <ul className="hero-stats">
            <li>
              <strong>{formatNumber(stats.games)}</strong> игр в базе
            </li>
            <li>
              <strong>{formatNumber(stats.sources)}</strong> с готовыми подборками
            </li>
            <li>
              <strong>{formatNumber(stats.edges)}</strong> связей между играми
            </li>
          </ul>
        </div>
        <HeroArt />
      </section>

      <section className="panel" aria-labelledby="picks-title">
        <h2 id="picks-title">Выберите игры, в которые вы играли и которые вам понравились</h2>
        <SearchBox index={index} exclude={new Set(picks)} onPick={addPick} disabled={picks.length >= MAX_PICKS} />
        {picks.length > 0 ? (
          <ul className="chips" aria-label="Выбранные игры">
            {picks.map((id) => {
              const g = index.byId.get(id)!
              return (
                <li key={id} className="chip pick-chip">
                  <span>{displayName(g)}</span>
                  {!index.out.has(id) && (
                    <span className="hint" title="У этой игры нет своего списка похожих игр. Подбираем через игры, в чьих списках она встречается.">
                      нет своего списка
                    </span>
                  )}
                  <button type="button" onClick={() => removePick(id)} aria-label={`Убрать ${displayName(g)}`}>
                    <CloseIcon />
                  </button>
                </li>
              )
            })}
            <li>
              <button type="button" className="link" onClick={() => updatePicks(() => [])}>
                Очистить
              </button>
            </li>
          </ul>
        ) : (
          <Starters index={index} onPick={addPick} />
        )}
      </section>

      {picks.length > 0 && (
        <div className="workspace">
          <aside className="panel filters" aria-labelledby="filters-title">
            <div className="filters-head">
              <h2 id="filters-title">Фильтры</h2>
              {activeFilters > 0 && (
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    setFilters({
                      players: null,
                      complexity: new Set(),
                      types: new Set(),
                      settings: new Set(),
                      downtime: new Set(),
                    })
                  }
                >
                  Сбросить ({activeFilters})
                </button>
              )}
            </div>
            <FilterRow label="Сколько вас">
              {PLAYER_OPTIONS.map((n) => (
                <Toggle
                  key={n}
                  on={filters.players === n}
                  onClick={() => setFilters((f) => ({ ...f, players: f.players === n ? null : n }))}
                >
                  {n === MANY_PLAYERS ? `${n}+` : n}
                </Toggle>
              ))}
            </FilterRow>
            <FilterRow label="Сложность">
              {COMPLEXITY.map((c) => (
                <Toggle key={c} on={filters.complexity.has(c)} onClick={() => setFilters((f) => ({ ...f, complexity: toggle(f.complexity, c) }))}>
                  {c}
                </Toggle>
              ))}
            </FilterRow>
            <FilterRow label="Даунтайм">
              {DOWNTIME.map((band) => (
                <Toggle key={band} on={filters.downtime.has(band)} onClick={() => setFilters((f) => ({ ...f, downtime: toggle(f.downtime, band) }))}>
                  {band}
                </Toggle>
              ))}
            </FilterRow>
            <FilterRow label="Тип игры">
              {typeOptions.map((t) => (
                <Toggle key={t} on={filters.types.has(t)} onClick={() => setFilters((f) => ({ ...f, types: toggle(f.types, t) }))}>
                  {t}
                </Toggle>
              ))}
            </FilterRow>
            <FilterRow label="Тема">
              {settingOptions.map((s) => (
                <Toggle key={s} on={filters.settings.has(s)} onClick={() => setFilters((f) => ({ ...f, settings: toggle(f.settings, s) }))}>
                  {s}
                </Toggle>
              ))}
            </FilterRow>
          </aside>

          <section className="results" aria-labelledby="results-title">
            <div className="results-head">
              <h2 id="results-title">
                Рекомендации <span className="count">{filtered.length}</span>
              </h2>
              <div className="tabs" role="tablist" aria-label="Вид">
                <button role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
                  Список
                </button>
                <button role="tab" aria-selected={view === 'graph'} className={view === 'graph' ? 'on' : ''} onClick={() => setView('graph')}>
                  Карта связей
                </button>
              </div>
            </div>
            <p className="muted small">
              {dislikes.length > 0
                ? 'Отмеченные игры убраны, близкие к ним опущены ниже.'
                : 'В эти игры играют те, кому нравятся выбранные вами.'}
            </p>
            {dislikes.length > 0 && (
              <ul className="chips" aria-label="Не нравится">
                <li className="dislike-label">Не нравится</li>
                {dislikes.map((id) => {
                  const g = index.byId.get(id)
                  if (!g) return null
                  return (
                    <li key={id} className="chip no-chip">
                      <span>{displayName(g)}</span>
                      <button type="button" onClick={() => undislike(id)} aria-label={`Вернуть ${displayName(g)}`}>
                        <CloseIcon />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {filtered.length === 0 ? (
              <p className="empty">
                {activeFilters > 0
                  ? 'Под эти фильтры ничего не нашлось. Ослабьте один из них.'
                  : 'После «не нравится» в списке ничего не осталось. Снимите одну из отметок.'}
              </p>
            ) : view === 'graph' ? (
              <Graph
                index={index}
                picks={picks}
                results={filtered.slice(0, GRAPH_SIZE)}
                onSelect={selectFromGraph}
                selectedId={selectedId}
              />
            ) : (
              <>
                <ol className="cards">
                  {filtered.slice(0, shown).map((r, i) => (
                    <ResultCard
                      key={r.game.id}
                      rec={r}
                      place={i + 1}
                      picks={picks}
                      selected={r.game.id === selectedId}
                      onAdd={() => addPick(r.game.id)}
                      onDislike={() => dislike(r.game.id)}
                      onOpen={() => setDetailId(r.game.id)}
                      canAdd={picks.length < MAX_PICKS}
                    />
                  ))}
                </ol>
                {shown < filtered.length && (
                  <button type="button" className="more" onClick={() => setShown((s) => s + PAGE)}>
                    Показать ещё ({filtered.length - shown})
                  </button>
                )}
              </>
            )}
          </section>
        </div>
      )}
      </>
      )}

      {detail && <GameDialog game={detail} onClose={() => setDetailId(null)} />}

      <footer className="footer muted small">
        <span className="brand small-brand">
          <LogoMark size={20} />
          <span className="wordmark">
            <b>ez</b> board game
          </span>
        </span>
        <span>По данным из открытых источников.</span>
      </footer>
    </main>
  )
}

function SearchBox({
  index,
  exclude,
  onPick,
  disabled,
}: {
  index: Index
  exclude: Set<number>
  onPick: (id: number) => void
  disabled: boolean
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hits = useMemo(() => searchGames(index, q, exclude), [index, q, exclude])

  const choose = (g: Game) => {
    onPick(g.id)
    setQ('')
    setActive(0)
    inputRef.current?.focus()
  }

  return (
    <div className="search">
      <label htmlFor="game-search" className="sr-only">
        Найти игру
      </label>
      <SearchIcon />
      <input
        id="game-search"
        ref={inputRef}
        type="search"
        autoComplete="off"
        placeholder={disabled ? `Можно выбрать до ${MAX_PICKS} игр` : 'Название по-русски или по-английски: Немезида, Inis…'}
        value={q}
        disabled={disabled}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls="search-list"
        aria-activedescendant={hits[active] ? `opt-${hits[active].id}` : undefined}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, hits.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && hits[active]) {
            e.preventDefault()
            choose(hits[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && q && (
        <ul id="search-list" role="listbox" className="suggest">
          {hits.length === 0 && <li className="muted none">Такой игры нет в базе</li>}
          {hits.map((g, i) => (
            <li
              key={g.id}
              id={`opt-${g.id}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(g)
              }}
              onMouseMove={() => i !== active && setActive(i)}
            >
              <span className="title">{g.ru ?? g.name}</span>
              {g.ru && <span className="muted">{g.name}</span>}
              <span className="meta">
                {[g.players && playersLabel(g.players), g.complexity].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Starters({ index, onPick }: { index: Index; onPick: (id: number) => void }) {
  const starters = useMemo(
    () => [...index.byId.values()].filter((g) => g.rank != null && g.rank > 0 && g.rank <= 40).slice(0, 14),
    [index],
  )
  return (
    <div className="starters">
      <p className="muted small">Или начните с популярных:</p>
      <ul className="chips">
        {starters.map((g) => (
          <li key={g.id}>
            <button type="button" className="chip ghost" onClick={() => onPick(g.id)}>
              {displayName(g)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Catalog({ index, onOpen }: { index: Index; onOpen: (id: number) => void }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'rank' | 'name'>('rank')
  const [shown, setShown] = useState(CATALOG_PAGE)
  const [filters, setFilters] = useState<Filters & { time: Set<string> }>({
    players: null,
    complexity: new Set(),
    types: new Set(),
    settings: new Set(),
    downtime: new Set(),
    time: new Set(),
  })
  const games = useMemo(() => [...index.byId.values()], [index])
  const typeOptions = useMemo(() => topGameLabels(games, (g) => g.types), [games])
  const settingOptions = useMemo(() => topGameLabels(games, (g) => g.settings), [games])
  const filtered = useMemo(() => {
    const q = normalize(query)
    const list = games.filter((g) => {
      if (!passesFilters(g, filters)) return false
      if (filters.time.size) {
        const band = playTimeBand(g)
        if (!band || !filters.time.has(band)) return false
      }
      if (!q) return true
      return normalize(g.name).includes(q) || (g.ru != null && normalize(g.ru).includes(q))
    })
    list.sort((a, b) => {
      if (sort === 'name') return displayName(a).localeCompare(displayName(b), 'ru')
      const ar = a.rank != null && a.rank > 0 ? a.rank : Number.POSITIVE_INFINITY
      const br = b.rank != null && b.rank > 0 ? b.rank : Number.POSITIVE_INFINITY
      return ar - br || displayName(a).localeCompare(displayName(b), 'ru')
    })
    return list
  }, [games, query, filters, sort])
  const active =
    (filters.players != null ? 1 : 0) +
    filters.complexity.size +
    filters.types.size +
    filters.settings.size +
    filters.downtime.size +
    filters.time.size

  return (
    <>
      <section className="page-head" aria-labelledby="catalog-title">
        <p className="eyebrow">База</p>
        <h1 id="catalog-title">Все игры</h1>
        <p className="lead">
          {formatNumber(games.length)} игр по месту в рейтинге BoardGameGeek. Рядом — средняя оценка BGG и рейтинг Тесеры.
        </p>
      </section>
      <div className="workspace">
        <aside className="panel filters" aria-labelledby="catalog-filters">
          <div className="filters-head">
            <h2 id="catalog-filters">Фильтры</h2>
            {active > 0 && (
              <button
                type="button"
                className="link"
                onClick={() =>
                  setFilters({
                    players: null,
                    complexity: new Set(),
                    types: new Set(),
                    settings: new Set(),
                    downtime: new Set(),
                    time: new Set(),
                  })
                }
              >
                Сбросить ({active})
              </button>
            )}
          </div>
          <div className="search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              placeholder="Название: Письма Призрака, Azul…"
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(CATALOG_PAGE)
              }}
              aria-label="Найти игру в списке"
            />
          </div>
          <FilterRow label="Игроков">
            {PLAYER_OPTIONS.map((n) => (
              <Toggle key={n} on={filters.players === n} onClick={() => setFilters((f) => ({ ...f, players: f.players === n ? null : n }))}>
                {n === MANY_PLAYERS ? `${n}+` : n}
              </Toggle>
            ))}
          </FilterRow>
          <FilterRow label="Сложность">
            {COMPLEXITY.map((c) => (
              <Toggle key={c} on={filters.complexity.has(c)} onClick={() => setFilters((f) => ({ ...f, complexity: toggle(f.complexity, c) }))}>
                {c}
              </Toggle>
            ))}
          </FilterRow>
          <FilterRow label="Время партии">
            {TIME_BANDS.map((band) => (
              <Toggle key={band} on={filters.time.has(band)} onClick={() => setFilters((f) => ({ ...f, time: toggle(f.time, band) }))}>
                {band}
              </Toggle>
            ))}
          </FilterRow>
          <FilterRow label="Даунтайм">
            {DOWNTIME.map((band) => (
              <Toggle key={band} on={filters.downtime.has(band)} onClick={() => setFilters((f) => ({ ...f, downtime: toggle(f.downtime, band) }))}>
                {band}
              </Toggle>
            ))}
          </FilterRow>
          <FilterRow label="Тип игры">
            {typeOptions.map((t) => (
              <Toggle key={t} on={filters.types.has(t)} onClick={() => setFilters((f) => ({ ...f, types: toggle(f.types, t) }))}>
                {t}
              </Toggle>
            ))}
          </FilterRow>
          <FilterRow label="Тема">
            {settingOptions.map((s) => (
              <Toggle key={s} on={filters.settings.has(s)} onClick={() => setFilters((f) => ({ ...f, settings: toggle(f.settings, s) }))}>
                {s}
              </Toggle>
            ))}
          </FilterRow>
        </aside>
        <section className="results" aria-labelledby="catalog-results">
          <div className="results-head">
            <h2 id="catalog-results">
              Игры <span className="count">{formatNumber(filtered.length)}</span>
            </h2>
            <div className="tabs" role="tablist" aria-label="Порядок">
              <button type="button" role="tab" aria-selected={sort === 'rank'} className={sort === 'rank' ? 'on' : ''} onClick={() => setSort('rank')}>
                По рейтингу
              </button>
              <button type="button" role="tab" aria-selected={sort === 'name'} className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>
                По названию
              </button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="empty">Под эти фильтры ничего не нашлось. Ослабьте один из них.</p>
          ) : (
            <>
              <ul className="cards">
                {filtered.slice(0, shown).map((g) => (
                  <CatalogCard key={g.id} game={g} onOpen={() => onOpen(g.id)} />
                ))}
              </ul>
              {shown < filtered.length && (
                <button type="button" className="more" onClick={() => setShown((s) => s + CATALOG_PAGE)}>
                  Показать ещё ({formatNumber(filtered.length - shown)})
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </>
  )
}

function formatScore(n: number): string {
  return n.toFixed(2)
}

function Scores({ g }: { g: Game }) {
  const place = g.rank != null && g.rank > 0 ? g.rank : null
  if (place == null && g.rating == null && g.tesera == null) return null
  const bggTitle =
    g.geek != null
      ? `Средняя оценка BGG. Место в списке считается по geek rating ${formatScore(g.geek)}`
      : 'Средняя оценка BGG'
  return (
    <p className="scores">
      {place != null && (
        <span className="score-rank" aria-label={`Место в рейтинге ${place}`}>
          #{formatNumber(place)}
        </span>
      )}
      {g.rating != null && (
        <span className="score bgg" title={bggTitle} aria-label={`BoardGameGeek, оценка ${formatScore(g.rating)}`}>
          <BggMark />
          <span className="score-num">{formatScore(g.rating)}</span>
        </span>
      )}
      {g.tesera != null && (
        <a
          className="score tesera"
          href={g.teseraAlias ? `https://tesera.ru/game/${g.teseraAlias}/` : 'https://tesera.ru/games/'}
          title="Рейтинг Тесеры"
          aria-label={`Тесера, оценка ${formatScore(g.tesera)}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <TeseraMark />
          <span className="score-num">{formatScore(g.tesera)}</span>
        </a>
      )}
    </p>
  )
}

function CatalogCard({ game: g, onOpen }: { game: Game; onOpen: () => void }) {
  return (
    <li className="card" onClick={onOpen}>
      <div className="cover-wrap">
        {g.image ? <img className="thumb" src={g.image} alt="" loading="lazy" /> : <span className="thumb empty" />}
      </div>
      <div className="card-body">
        <div className="card-title">
          <h3>
            <button type="button" className="card-name">
              {g.ru ?? g.name}
            </button>
          </h3>
          {g.ru && <p className="muted small">{g.name}</p>}
          <Scores g={g} />
        </div>
        <GameFacts game={g} />
        <GameTags game={g} />
        <a className="link add" href={`${import.meta.env.BASE_URL}?g=${g.id}`} onClick={(e) => e.stopPropagation()}>
          Подобрать похожие
        </a>
      </div>
    </li>
  )
}

function playTimeBand(g: Game): (typeof TIME_BANDS)[number] | null {
  if (!g.time) return null
  const mid = (g.time[0] + g.time[1]) / 2
  if (mid <= 60) return 'до 1 ч'
  if (mid <= 90) return '1–1,5 ч'
  if (mid <= 120) return '1,5–2 ч'
  return '2 ч+'
}

function topGameLabels(games: Game[], get: (g: Game) => string[]): string[] {
  const counts = new Map<string, number>()
  for (const g of games) for (const l of get(g)) counts.set(l, (counts.get(l) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
    .map(([label]) => label)
}

function ResultCard({
  rec,
  place,
  picks,
  selected,
  onAdd,
  onDislike,
  onOpen,
  canAdd,
}: {
  rec: Recommendation
  place: number
  picks: number[]
  selected: boolean
  onAdd: () => void
  onDislike: () => void
  onOpen: () => void
  canAdd: boolean
}) {
  const g = rec.game
  return (
    <li id={`rec-${g.id}`} className={`card ${selected ? 'selected' : ''}`} onClick={onOpen}>
      <div className="cover-wrap">
        {g.image ? <img className="thumb" src={g.image} alt="" loading="lazy" /> : <span className="thumb empty" />}
        <span className="place" aria-label={`Место ${place}`}>{place}</span>
      </div>
      <div className="card-body">
        <div className="card-main">
          <div className="card-title">
            <h3>
              <button type="button" className="card-name">
                {g.ru ?? g.name}
              </button>
            </h3>
            {g.ru && <p className="muted small">{g.name}</p>}
            <Scores g={g} />
          </div>
          <div className="match" aria-label={`Совпадение ${rec.match}%`}>
            <strong>{rec.match}%</strong>
            <span className="bar">
              <span style={{ width: `${rec.match}%` }} />
            </span>
            {picks.length > 1 && (
              <span className={`cover ${rec.coveredPicks === picks.length ? 'full' : ''}`}>
                совпадение {rec.coveredPicks} из {picks.length}
              </span>
            )}
          </div>
        </div>
        <GameFacts game={g} />
        <GameTags game={g} />
        <div className="card-actions">
          {canAdd && (
            <button
              type="button"
              className="link add"
              onClick={(e) => {
                e.stopPropagation()
                onAdd()
              }}
            >
              + Мне тоже нравится
            </button>
          )}
          <button
            type="button"
            className="link add no"
            onClick={(e) => {
              e.stopPropagation()
              onDislike()
            }}
          >
            Не нравится
          </button>
        </div>
      </div>
    </li>
  )
}

function formatTime([min, max]: [number, number]): string {
  return min === max ? `${min} мин` : `${min}–${max} мин`
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="filter-row" role="group" aria-label={label}>
      <span className="filter-label">{label}</span>
      <div className="toggles">{children}</div>
    </div>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}

function topLabels(recs: Recommendation[], get: (g: Game) => string[], limit: number): string[] {
  const counts = new Map<string, number>()
  for (const r of recs) for (const l of get(r.game)) counts.set(l, (counts.get(l) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([l]) => l)
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function displayName(g: Game): string {
  return g.ru ?? g.name
}

function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU')
}

function playersLabel(players: string): string {
  const max = Number(players.split('-').pop())
  const word = max % 10 === 1 && max % 100 !== 11 ? 'игрок' : max % 10 >= 2 && max % 10 <= 4 && (max % 100 < 12 || max % 100 > 14) ? 'игрока' : 'игроков'
  return `${players.replace('-', '–')} ${word}`
}

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function GameFacts({ game }: { game: Game }) {
  if (!game.players && !game.complexity && !game.time && !game.downtime) return null
  return (
    <ul className="facts">
      {game.players && (
        <li className="fact-icon" title="Сколько игроков" aria-label={`Игроков: ${game.players}`}>
          <PlayersIcon />
          {game.players.replace('-', '–')}
        </li>
      )}
      {game.complexity && (
        <li
          className="fact-icon"
          title="Сложность по шкале от 1 до 5"
          aria-label={`Сложность: ${game.complexity}${game.weight ? `, ${game.weight} из 5` : ''}`}
        >
          <ComplexityIcon level={COMPLEXITY.indexOf(game.complexity) + 1} />
          {game.complexity}
          {game.weight ? ` (${game.weight})` : ''}
        </li>
      )}
      {game.time && (
        <li className="fact-icon" title="Время партии" aria-label={`Время партии: ${formatTime(game.time)}`}>
          <ClockIcon />
          {formatTime(game.time)}
        </li>
      )}
      {game.downtime && (
        <li className="fact-icon" title="Даунтайм" aria-label={`Даунтайм: ${game.downtime}`}>
          <DowntimeIcon />
          {game.downtime}
        </li>
      )}
    </ul>
  )
}

function GameTags({ game }: { game: Game }) {
  if (game.types.length === 0 && game.settings.length === 0) return null
  return (
    <ul className="tags">
      {game.types.slice(0, 4).map((t) => <li key={t}>{t}</li>)}
      {game.settings.slice(0, 3).map((s) => <li key={s} className="setting">{s}</li>)}
    </ul>
  )
}

function playerPoints(text: string | undefined): string[] | null {
  const raw = text?.trim()
  if (!raw) return null
  const low = raw.toLowerCase()
  if (low.startsWith('не проверено') || low.startsWith('не сведено')) return null
  const parts = raw.split(';').map((part) => part.trim()).filter(Boolean)
  return parts.length ? parts : null
}

function GameDialog({ game, onClose }: { game: Game; onClose: () => void }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])
  const pros = playerPoints(game.pros)
  const cons = playerPoints(game.cons)
  const tesera = game.teseraAlias ? `https://tesera.ru/game/${game.teseraAlias}/` : null
  return (
    <div className="game-dialog-backdrop" onClick={onClose}>
      <article
        className="game-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Закрыть">
          <CloseIcon />
        </button>
        <div className="dialog-head">
          {game.image ? <img className="thumb" src={game.image} alt="" /> : <span className="thumb empty" />}
          <div>
            <h2 id="game-dialog-title">{game.ru ?? game.name}</h2>
            {game.ru && <p className="muted small">{game.name}</p>}
            <Scores g={game} />
            <GameFacts game={game} />
            <GameTags game={game} />
          </div>
        </div>
        <p className="dialog-about">{game.about ?? 'Короткого описания в базе нет.'}</p>
        <h3>Плюсы</h3>
        {pros ? (
          <ul className="point-list pros">
            {pros.map((point) => <li key={point}>{point}</li>)}
          </ul>
        ) : (
          <p className="muted small">Плюсов от игроков пока нет.</p>
        )}
        <h3>Минусы</h3>
        {cons ? (
          <ul className="point-list cons">
            {cons.map((point) => <li key={point}>{point}</li>)}
          </ul>
        ) : (
          <p className="muted small">Минусов от игроков пока нет.</p>
        )}
        <p className="dialog-links">
          <a href={`https://boardgamegeek.com/boardgame/${game.id}`} target="_blank" rel="noreferrer">
            <BggMark /> BoardGameGeek
          </a>
          {tesera && (
            <a href={tesera} target="_blank" rel="noreferrer">
              <TeseraMark /> Тесера
            </a>
          )}
        </p>
      </article>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}
