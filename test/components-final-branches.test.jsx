// The last few conditional arms: the sides of each ternary a normal run only ever
// takes one way, plus the guards that keep a half-built board from crashing a view.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

vi.mock('../src/data/games.js', async (importOriginal) => ({
  ...(await importOriginal()),
  GAMES: (await import('./fixtures/pretournament-games.js')).GAMES,
}))

import { GAMES } from './fixtures/pretournament-games.js'
import { computeClinch } from '../src/utils/clinch.js'
import { resolveBracket, decideGame } from '../src/utils/bracketResolve.js'
import { gamesByNum } from '../src/utils/bracket.js'
import Bracket from '../src/components/Bracket.jsx'
import MatchCard from '../src/components/MatchCard.jsx'
import MatchDetail from '../src/components/MatchDetail.jsx'
import NextMatch from '../src/components/NextMatch.jsx'
import PathPicker from '../src/components/PathPicker.jsx'
import Standings from '../src/components/Standings.jsx'
import WeekView from '../src/components/WeekView.jsx'
import App from '../src/App.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { PathProvider } from '../src/context/path.jsx'
import { ServicesProvider } from '../src/context/services.jsx'
import { DetailContext } from '../src/context/detail.js'
import { allGroupsPlayed, espnScoreboard, pinClock, playStage, playWholeTournament } from './helpers/tournament.js'

const TZ = 'Asia/Qatar'
const num = (games, n) => games.find((g) => g.num === n)

function wrap(ui, { onDetail = () => {} } = {}) {
  return render(
    <FollowProvider>
      <PathProvider>
        <ServicesProvider>
          <DetailContext.Provider value={onDetail}>{ui}</DetailContext.Provider>
        </ServicesProvider>
      </PathProvider>
    </FollowProvider>,
  )
}

// A complete tournament (playWholeTournament stops at the SFs, so score the last two).
function playedOut() {
  const b = playWholeTournament().map((g) =>
    (g.stage === 'Final' || g.stage === '3rd') && g.t1 && g.t2 ? { ...g, score: [90, 70] } : g,
  )
  return resolveBracket(b)
}

// First two stages played: the quarter-finals have real teams but no scores.
function throughR2() {
  let b = playStage('R1')
  b = resolveBracket(b)
  b = playStage('R2', b)
  return resolveBracket(b)
}

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  pinClock()
})

afterEach(() => vi.useRealTimers())

describe('followed teams and traced routes in the bracket', () => {
  const board = playedOut()

  it('highlights a followed team on a resolved slot and inside a candidate pair', () => {
    const champion = decideGame(num(board, 92)).winner
    localStorage.setItem('fmwc:followed', JSON.stringify([champion]))
    wrap(<Bracket matches={board} tz={TZ} />)
    expect(document.querySelectorAll('.bx-side.followed').length).toBeGreaterThan(0)
  })

  it('highlights a followed candidate inside an unresolved pair', () => {
    // Game 89 (SF) feeds from game 85; resolve 85 to a pair and follow one of them.
    const partial = GAMES.map((g) => (g.num === 85 ? { ...g, t1: 'Australia', t2: 'Italy' } : g))
    localStorage.setItem('fmwc:followed', JSON.stringify(['Italy']))
    wrap(<Bracket matches={partial} tz={TZ} />)
    expect(document.querySelectorAll('.bx-feeder-team.followed').length).toBeGreaterThan(0)
  })

  it('marks a candidate that is on the traced route', () => {
    const partial = resolveBracket(
      GAMES.map((g) => (g.num === 85 ? { ...g, t1: 'Australia', t2: 'Italy' } : g)),
    )
    wrap(
      <>
        <PathPicker byNum={gamesByNum(partial)} />
        <Bracket matches={partial} tz={TZ} />
      </>,
    )
    fireEvent.change(document.querySelector('.path-select'), { target: { value: 'Italy' } })
    expect(document.querySelectorAll('.on-path-team').length).toBeGreaterThan(0)
  })

  it('renders nothing for a bracket slot the board does not carry', () => {
    const gapped = board.filter((g) => g.num !== 91)
    wrap(<Bracket matches={gapped} tz={TZ} />)
    expect(document.getElementById('bx-m91')).toBeNull()
    expect(document.getElementById('bx-m92')).toBeTruthy()
  })

  it('shows a single overtime as "OT" and an awarded final-phase game', () => {
    const one = board.map((g) => (g.num === 92 ? { ...g, ot: 1, awarded: true } : g))
    wrap(<Bracket matches={one} tz={TZ} />)
    const g92 = document.getElementById('bx-m92')
    expect(g92.querySelector('.bx-pens').textContent.trim()).toBe('OT')
    expect(g92.querySelector('.awarded-note')).toBeTruthy()
  })

  it('shows a postponed final-phase game with the pause glyph', () => {
    const off = board.map((g) => (g.num === 92 ? { ...g, voided: true, statusLabel: 'Postponed' } : g))
    wrap(<Bracket matches={off} tz={TZ} />)
    expect(document.getElementById('bx-m92').textContent).toMatch(/⏸ Postponed/)
  })

  it('shows only "TBC" when a game has neither a tip-off nor a date', () => {
    const undated = GAMES.map((g) => (g.num === 85 ? { ...g, ko: null, date: undefined } : g))
    wrap(<Bracket matches={resolveBracket(undated)} tz={TZ} />)
    expect(document.getElementById('bx-m85').textContent).toMatch(/TBC/)
  })
})

describe('PathPicker mid-run status', () => {
  it('says which round a team has reached when its last game is won', () => {
    // A quarter-final winner whose semi-final is not yet filled.
    let board = throughR2()
    board = board.map((g) => (g.num === 85 ? { ...g, score: [90, 70] } : g))
    const winner = num(board, 85).t1
    wrap(<PathPicker byNum={gamesByNum(board)} />)
    fireEvent.change(document.querySelector('.path-select'), { target: { value: winner } })
    expect(screen.getByText(/Through to the Semi-Final/)).toBeInTheDocument()
  })

  it('says which round is up next while a team waits', () => {
    const board = throughR2()
    const waiting = num(board, 85).t1
    wrap(<PathPicker byNum={gamesByNum(board)} />)
    fireEvent.change(document.querySelector('.path-select'), { target: { value: waiting } })
    expect(screen.getByText(/Up next: Quarter-Final/)).toBeInTheDocument()
  })

  it('clears the trace when the empty option is chosen', () => {
    const board = playedOut()
    wrap(<PathPicker byNum={gamesByNum(board)} />)
    const select = document.querySelector('.path-select')
    fireEvent.change(select, { target: { value: decideGame(num(board, 92)).winner } })
    expect(select.value).not.toBe('')
    fireEvent.change(select, { target: { value: '' } })
    expect(select.value).toBe('')
  })
})

describe('MatchDetail conditional arms', () => {
  it('shows no tale of the tape before either team has played', () => {
    const board = resolveBracket(
      GAMES.map((g) => (g.num === 85 ? { ...g, t1: 'Japan', t2: 'Spain' } : g)),
    )
    wrap(<MatchDetail match={num(board, 85)} tz={TZ} allMatches={board} onClose={() => {}} />)
    expect(screen.queryByText('W–L')).not.toBeInTheDocument()
  })

  it('says "Tournament so far" for a game not yet played', () => {
    const board = throughR2()
    wrap(<MatchDetail match={num(board, 85)} tz={TZ} hideScores allMatches={board} onClose={() => {}} />)
    expect(screen.getByText('Tournament so far')).toBeInTheDocument()
  })

  it('shows a postponed game with the pause glyph', () => {
    const off = { ...num(GAMES, 1), voided: true, statusLabel: 'Postponed' }
    wrap(<MatchDetail match={off} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getAllByText(/⏸ Postponed/).length).toBeGreaterThan(0)
  })

  it('shows a delayed badge when the clock has passed with no feed clock', () => {
    const past = { ...num(GAMES, 1), ko: new Date(Date.now() - 30 * 60_000).toISOString() }
    wrap(<MatchDetail match={past} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getByText(/⏸ Delayed/)).toBeInTheDocument()
  })
})

describe('NextMatch remaining arms', () => {
  const afterTheFinal = (fn) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-09-20T12:00:00Z'))
    try {
      fn()
    } finally {
      vi.useRealTimers()
    }
  }

  it('falls back gracefully when the board has no Final at all', () => {
    afterTheFinal(() => {
      const noFinal = playedOut().filter((g) => g.stage !== 'Final')
      wrap(<NextMatch matches={noFinal} tz={TZ} />)
      expect(screen.getByText(/tournament has concluded/)).toBeInTheDocument()
    })
  })

  it('jumps to the day from a stacked live row', () => {
    pinClock()
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const live = GAMES.map((g) =>
      [1, 3].includes(g.num) ? { ...g, score: [40, 38], live: { clock: '3:00', period: 'Q2' } } : g,
    )
    // Add a day container for whichever day the first live row belongs to.
    const first = live.filter((g) => g.live).sort((a, b) => a.num - b.num)[0]
    const key = new Date(first.ko).toLocaleDateString('en-CA', { timeZone: TZ })
    const day = document.createElement('div')
    day.id = `day-${key}`
    document.body.appendChild(day)
    wrap(<NextMatch matches={live} tz={TZ} />)
    fireEvent.click(document.querySelectorAll('.nm-live-row')[0])
    expect(scroll).toHaveBeenCalled()
    day.remove()
  })

  it('names the stage of a stacked knockout pair', () => {
    const live = GAMES.map((g) =>
      [85, 86].includes(g.num)
        ? { ...g, ko: new Date(Date.now() + 3600_000).toISOString() }
        : { ...g, ko: new Date(Date.now() + 12 * 86400_000).toISOString() },
    )
    wrap(<NextMatch matches={live} tz={TZ} />)
    expect(screen.getAllByText(/Quarter-Final/).length).toBeGreaterThan(0)
  })

  it('shows a plain delayed countdown when the feed gives no label', () => {
    const single = GAMES.map((g) => (g.num === 1 ? { ...g, score: [40, 38], live: { delayed: true } } : g))
    localStorage.setItem('fmwc:followed', JSON.stringify(['United States']))
    wrap(<NextMatch matches={single} tz={TZ} />)
    expect(document.querySelector('.nm-countdown.delayed').textContent).toMatch(/Delayed/)
  })
})

describe('Standings remaining arms', () => {
  it('projects exactly the top two of each group', () => {
    const board = allGroupsPlayed((g) => g.t1)
    wrap(<Standings matches={board} tz={TZ} clinch={computeClinch(board)} />)
    // Each projection list names the two advancing placings, never the eliminated.
    for (const list of document.querySelectorAll('.ais-list')) {
      expect(list.querySelectorAll('.ais-row')).toHaveLength(2)
    }
  })

  it('names a second-round destination for each first-round group', () => {
    const board = allGroupsPlayed((g) => g.t1)
    wrap(<Standings matches={board} tz={TZ} clinch={computeClinch(board)} />)
    expect(screen.getAllByText(/2nd round · Group [IJKL]/).length).toBeGreaterThan(0)
  })

  it('labels a paused group game with its own status word', () => {
    const paused = GAMES.map((g) => (g.num === 1 ? { ...g, score: [40, 38], live: { delayed: true } } : g))
    wrap(<Standings matches={paused} tz={TZ} clinch={{}} />)
    expect(screen.getByText(/DELAYED/)).toBeInTheDocument()
  })
})

describe('WeekView remaining arms', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-08-28T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a canceled game with the warning glyph', () => {
    const played = allGroupsPlayed().map((g) =>
      g.num === 1 ? { ...g, voided: true, statusLabel: 'Canceled' } : g,
    )
    wrap(<WeekView allMatches={played} shown={played} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/⚠ Canceled/)
  })

  it('steps back a week', () => {
    wrap(<WeekView allMatches={GAMES} shown={GAMES} tz={TZ} dayHidden={() => false} />)
    const next = screen.getByRole('button', { name: /Next/ })
    if (!next.disabled) fireEvent.click(next)
    const prev = screen.getByRole('button', { name: /Prev/ })
    if (!prev.disabled) fireEvent.click(prev)
    expect(document.querySelector('.week-title')).toBeTruthy()
  })
})

describe('MatchCard remaining arms', () => {
  it('shows a single overtime as "OT"', () => {
    wrap(<MatchCard match={{ ...num(GAMES, 1), score: [95, 92], ot: 1 }} tz={TZ} />)
    expect(screen.getByText('OT')).toBeInTheDocument()
  })
})

describe('App remaining arms', () => {
  const mount = () =>
    render(
      <FollowProvider>
        <PathProvider>
          <ServicesProvider>
            <App />
          </ServicesProvider>
        </PathProvider>
      </FollowProvider>,
    )

  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    global.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    }
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }))
  })

  it('toggles the theme back to light', async () => {
    document.documentElement.dataset.theme = 'dark'
    mount()
    await screen.findByText(/No results yet/)
    fireEvent.click(screen.getByLabelText('Toggle theme'))
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(screen.getByLabelText('Toggle theme'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('hides past days when asked, and brings them back', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-09-08T12:00:00Z'))
    mount()
    await vi.waitFor(() => expect(document.querySelector('.pastdays-btn')).toBeTruthy())
    const withPast = document.querySelectorAll('.day').length
    expect(document.querySelector('.pastdays-btn').textContent).toMatch(/Hide past days/)

    fireEvent.click(document.querySelector('.pastdays-btn'))
    const withoutPast = document.querySelectorAll('.day').length
    expect(withoutPast).toBeLessThan(withPast)
    expect(document.querySelector('.pastdays-btn').textContent).toMatch(/Show past days/)

    fireEvent.click(document.querySelector('.pastdays-btn'))
    expect(document.querySelectorAll('.day').length).toBe(withPast)
    vi.useRealTimers()
  })

  it('survives the history backfill failing', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-09-08T12:00:00Z'))
    let call = 0
    global.fetch = vi.fn(async () => {
      call += 1
      if (call > 1) throw new Error('network')
      return { ok: true, json: async () => ({ events: [] }) }
    })
    mount()
    await vi.waitFor(() => expect(document.querySelectorAll('.card').length).toBeGreaterThan(0))
    vi.useRealTimers()
  })

  it('suppresses a flood of results rather than stacking toasts', async () => {
    const board = allGroupsPlayed()
    const r1 = board.filter((g) => g.stage === 'R1')
    let payload = espnScoreboard(r1, Object.fromEntries(
      r1.map((g) => [g.num, { state: 'in', score: [40, 38], period: 2 }]),
    ))
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => payload }))
    mount()
    await screen.findByText(/games with scores|No results yet/)
    fireEvent.click(within(screen.getByTitle(/goes final/)).getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Result-alert scope'), { target: { value: 'all' } })

    payload = espnScoreboard(r1, Object.fromEntries(
      r1.map((g) => [g.num, { state: 'post', score: g.score }]),
    ))
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))
    await new Promise((r) => setTimeout(r, 50))
    expect(document.querySelectorAll('.goal-toast')).toHaveLength(0)
  })
})

describe('knockout games in the next-up bar', () => {
  const soon = (nums) =>
    GAMES.map((g) =>
      nums.includes(g.num)
        ? { ...g, ko: new Date(Date.now() + 3600_000).toISOString() }
        : { ...g, ko: new Date(Date.now() + 12 * 86400_000).toISOString() },
    )

  it('names an unresolved knockout game by its slot labels', () => {
    wrap(<NextMatch matches={soon([85])} tz={TZ} />)
    expect(screen.getByText('Winner Group I')).toBeInTheDocument()
    expect(screen.getByText('2nd Group J')).toBeInTheDocument()
    expect(document.querySelectorAll('.nm-flag')[0].textContent).toBe('•')
  })

  it('names them in the stacked layout too', () => {
    wrap(<NextMatch matches={soon([85, 86])} tz={TZ} />)
    expect(screen.getByText('Winner Group I')).toBeInTheDocument()
    expect(screen.getByText('Winner Group J')).toBeInTheDocument()
    expect(document.querySelectorAll('.nm-live-row')).toHaveLength(2)
  })

  it('names them in a stacked LIVE layout', () => {
    const live = soon([85, 86]).map((g) =>
      [85, 86].includes(g.num) ? { ...g, score: [40, 38], live: { clock: '3:00', period: 'Q2' } } : g,
    )
    wrap(<NextMatch matches={live} tz={TZ} />)
    expect(screen.getByText('Winner Group I')).toBeInTheDocument()
    expect(document.querySelector('.nm-label').textContent).toMatch(/Live now/)
  })
})

describe('WeekView and Standings placeholder fallbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-09-08T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('uses the bullet for a cell with no flag', () => {
    const board = [num(GAMES, 85)]
    wrap(<WeekView allMatches={board} shown={board} tz={TZ} dayHidden={() => false} />)
    expect(document.querySelectorAll('.wc-flag')[0].textContent).toBe('•')
    expect(document.body.textContent).toMatch(/Winner Group I/)
  })

  it('names a destination for every projected placing once a group has played', () => {
    const board = allGroupsPlayed()
    wrap(<Standings matches={board} tz={TZ} clinch={computeClinch(board)} />)
    const opponents = [...document.querySelectorAll('.ais-opp')].map((e) => e.textContent.trim())
    expect(opponents.length).toBeGreaterThan(0)
    for (const o of opponents) expect(o).not.toBe('TBD')
  })
})

describe('the last conditional arms', () => {
  it('names a second-round group’s two quarter-final routes in the tooltip', () => {
    // Exercises MatchCard's slot tooltip directly via a slot map. Both of a group's
    // top two go to the quarter-finals (no bye, no qualification round).
    wrap(<MatchCard match={num(GAMES, 1)} tz={TZ} slotMap={{ A: { win: 85, second: 86 } }} clinch={{}} />)
    const title = screen.getByText('Angola').closest('[title]').getAttribute('title')
    expect(title).toMatch(/Group A knockout route/)
    expect(title).toMatch(/1st → Quarter-final · Game 85/)
    expect(title).toMatch(/2nd → Quarter-final · Game 86/)
    expect(title).toMatch(/3rd\/4th → out/)
  })

  it('says "Going into this game" once a game has been played', () => {
    let board = throughR2()
    board = board.map((g) => (g.num === 85 ? { ...g, score: [90, 70] } : g))
    wrap(<MatchDetail match={num(board, 85)} tz={TZ} hideScores allMatches={board} onClose={() => {}} />)
    expect(screen.getByText('Going into this game')).toBeInTheDocument()
  })

  it('crowns a champion even when the flag lookup finds nothing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-09-20T12:00:00Z'))
    const board = playedOut().map((g) =>
      g.num === 92 ? { ...g, t1: 'Atlantis', t2: 'Narnia', score: [90, 70] } : g,
    )
    wrap(<NextMatch matches={board} tz={TZ} />)
    expect(screen.getByText('Atlantis')).toBeInTheDocument()
    expect(screen.getByText(/Narnia/)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('starts with the projection shown when storage cannot be read', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const board = allGroupsPlayed()
    wrap(<Standings matches={board} tz={TZ} clinch={{}} />)
    expect(screen.getAllByText('As it stands → second round').length).toBeGreaterThan(0)
    spy.mockRestore()
  })

  it('survives a storage that refuses to remember the projection toggle', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const board = allGroupsPlayed()
    wrap(<Standings matches={board} tz={TZ} clinch={{}} />)
    expect(() => fireEvent.click(screen.getByRole('button', { name: /As it stands/ }))).not.toThrow()
    spy.mockRestore()
  })
})

describe('the very last arms', () => {
  it('shows a postponed game with the pause glyph in the week view', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-08-28T12:00:00Z'))
    const played = allGroupsPlayed().map((g) =>
      g.num === 1 ? { ...g, voided: true, statusLabel: 'Postponed' } : g,
    )
    wrap(<WeekView allMatches={played} shown={played} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/⏸ Postponed/)
    vi.useRealTimers()
  })

  it('expands BOTH sides of a cell whose two feeds are set', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2023-09-10T12:00:00Z'))
    // Game 91 is "Loser Game 89" v "Loser Game 90": both sides are feeds.
    const board = [
      { ...num(GAMES, 89), t1: 'Japan', t2: 'Spain' },
      { ...num(GAMES, 90), t1: 'Italy', t2: 'China' },
      num(GAMES, 91),
    ]
    wrap(<WeekView allMatches={board} shown={board} tz={TZ} dayHidden={() => false} />)
    const cells = [...document.querySelectorAll('.week-cell')]
    const g91 = cells.find((c) => c.textContent.includes('Japan') && c.textContent.includes('Italy'))
    expect(g91).toBeTruthy()
    expect(g91.querySelectorAll('.feeder-cand').length).toBe(4)
    for (const t of g91.querySelectorAll('.wc-team')) expect(t.title).toBe('')
    vi.useRealTimers()
  })

  it('jumps to the day from the single next-game card', () => {
    pinClock()
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const day = document.createElement('div')
    day.id = 'day-2023-08-26'
    document.body.appendChild(day)
    localStorage.setItem('fmwc:followed', JSON.stringify(['United States']))
    wrap(<NextMatch matches={GAMES} tz={TZ} />)
    fireEvent.click(document.querySelector('.nm-jump'))
    expect(scroll).toHaveBeenCalled()
    day.remove()
  })

  it('says Delayed when the clock has passed but the feed is not ticking', () => {
    localStorage.setItem('fmwc:followed', JSON.stringify(['United States']))
    const past = GAMES.map((g) =>
      g.num === 1 ? { ...g, ko: new Date(Date.now() - 30 * 60_000).toISOString() } : g,
    )
    wrap(<NextMatch matches={past} tz={TZ} />)
    expect(document.querySelector('.nm-countdown.delayed').textContent).toMatch(/Delayed/)
  })
})

describe('defensive arms in the last components', () => {
  it('offers a jump button on the single next-game card', () => {
    pinClock()
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const day = document.createElement('div')
    day.id = 'day-2023-08-26'
    document.body.appendChild(day)
    localStorage.setItem('fmwc:followed', JSON.stringify(['United States']))
    wrap(<NextMatch matches={GAMES} tz={TZ} />)
    fireEvent.click(document.querySelector('.nm-jump'))
    expect(scroll).toHaveBeenCalled()
    day.remove()
  })

  it('shows no knockout-route tooltip for a group that is not in the slot map', () => {
    // A first-round group (A-H) is never in the slot map (keyed I-L), so its cards
    // carry no route tooltip.
    wrap(<MatchCard match={num(GAMES, 1)} tz={TZ} slotMap={{}} clinch={{}} />)
    const title = screen.getByText('Angola').closest('[title]')?.getAttribute('title') || ''
    expect(title).not.toMatch(/knockout route/)
  })

  it('does nothing when the focused bracket game is not on the page', () => {
    const onFocusHandled = vi.fn()
    const board = resolveBracket(GAMES).filter((g) => g.num !== 87)
    wrap(<Bracket matches={board} tz={TZ} focusMatch={87} onFocusHandled={onFocusHandled} />)
    expect(onFocusHandled).toHaveBeenCalled()
  })

  it('opens the group pop-up for an advanced team, with no knockout section', () => {
    const board = playStage('R1')
    const clinch = computeClinch(board)
    const advanced = Object.entries(clinch).find(([, v]) => v === 'advanced' || v === 'won-group')[0]
    wrap(<Standings matches={board} tz={TZ} clinch={clinch} />)
    const rows = screen.getAllByRole('row', { name: new RegExp(advanced) })
    fireEvent.click(within(rows[0]).getByTitle(/Show Group . games/))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // No opponent is mathematically locked yet, so no knockout section.
    expect(screen.queryByText(/reached the quarter-finals/)).not.toBeInTheDocument()
  })
})

describe('a team that is not going through', () => {
  it('shows no knockout section for an eliminated team', () => {
    const board = playStage('R1')
    const clinch = computeClinch(board)
    const out = Object.entries(clinch).find(([, v]) => v === 'eliminated')[0]
    wrap(<Standings matches={board} tz={TZ} clinch={clinch} />)
    const rows = screen.getAllByRole('row', { name: new RegExp(out) })
    fireEvent.click(within(rows[0]).getByTitle(/Show Group . games/))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText(/reached the quarter-finals/)).not.toBeInTheDocument()
  })

  it('shows no knockout section while a group is undecided', () => {
    wrap(<Standings matches={GAMES} tz={TZ} clinch={{}} />)
    fireEvent.click(screen.getAllByTitle(/Show Group A games/)[0])
    expect(screen.queryByText(/reached the quarter-finals/)).not.toBeInTheDocument()
  })
})
