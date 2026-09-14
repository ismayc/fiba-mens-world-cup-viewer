// The states that only exist late in a tournament: a champion crowned, a route
// traced to the trophy, an abandoned game, a forfeit, and the mobile bracket
// jumping between rounds. Driven from synthetic end-states.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import { GAMES } from './fixtures/pretournament-games.js'
import { computeClinch } from '../src/utils/clinch.js'
import { resolveBracket, decideGame } from '../src/utils/bracketResolve.js'
import { gamesByNum } from '../src/utils/bracket.js'
import Bracket from '../src/components/Bracket.jsx'
import MatchCard from '../src/components/MatchCard.jsx'
import MatchDetail from '../src/components/MatchDetail.jsx'
import NextMatch from '../src/components/NextMatch.jsx'
import PathPicker from '../src/components/PathPicker.jsx'
import Filters from '../src/components/Filters.jsx'
import LiveBadge from '../src/components/LiveBadge.jsx'
import WeekView from '../src/components/WeekView.jsx'
import Standings from '../src/components/Standings.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { PathProvider } from '../src/context/path.jsx'
import { ServicesProvider } from '../src/context/services.jsx'
import { DetailContext } from '../src/context/detail.js'
import { allGroupsPlayed, playStage, playWholeTournament, pinClock } from './helpers/tournament.js'

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

// A complete tournament: playWholeTournament plays through the semi-finals and
// resolves the Final/third-place slots, so score those two here for a champion.
const playedOut = () => {
  const b = playWholeTournament().map((g) =>
    (g.stage === 'Final' || g.stage === '3rd') && g.t1 && g.t2 ? { ...g, score: [90, 70] } : g,
  )
  return resolveBracket(b)
}

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  pinClock()
})

afterEach(() => vi.useRealTimers())

describe('a finished tournament', () => {
  const board = playedOut()
  const champion = decideGame(num(board, 92)).winner
  const runnerUp = decideGame(num(board, 92)).loser

  const afterTheFinal = (fn) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-09-20T12:00:00Z'))
    try {
      fn()
    } finally {
      vi.useRealTimers()
    }
  }

  it('crowns the champion and names the runners-up', () => {
    afterTheFinal(() => {
      wrap(<NextMatch matches={board} tz={TZ} />)
      expect(screen.getByText(/champions/i)).toBeInTheDocument()
      expect(screen.getByText(champion)).toBeInTheDocument()
      expect(screen.getByText(/Runners-up/)).toBeInTheDocument()
    })
  })

  it('falls back to a generic message when the Final has no result', () => {
    afterTheFinal(() => {
      const noFinal = board.map((g) => (g.num === 92 ? { ...g, score: undefined } : g))
      wrap(<NextMatch matches={noFinal} tz={TZ} />)
      expect(screen.getByText(/tournament has concluded/)).toBeInTheDocument()
    })
  })

  it('marks the champion’s traced route as won', () => {
    wrap(<PathPicker byNum={gamesByNum(board)} />)
    fireEvent.change(document.querySelector('.path-select'), { target: { value: champion } })
    expect(screen.getByText(/Champions!/)).toBeInTheDocument()
  })

  it('offers a shortcut chip for each followed team in the bracket', () => {
    const loser = num(board, 92).t2
    localStorage.setItem('fmwc:followed', JSON.stringify([loser]))
    wrap(<PathPicker byNum={gamesByNum(board)} />)
    expect(document.querySelector('.path-chips')).toBeTruthy()
    const chip = screen.getByRole('button', { name: new RegExp(loser) })
    fireEvent.click(chip)
    expect(document.querySelector('.path-select').value).toBe(loser)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(loser) }))
    expect(document.querySelector('.path-select').value).toBe('')
  })

  it('marks a beaten team’s route as knocked out', () => {
    const loser = num(board, 92).t2
    wrap(<PathPicker byNum={gamesByNum(board)} />)
    fireEvent.change(document.querySelector('.path-select'), { target: { value: loser } })
    expect(document.querySelector('.path-status')).toBeTruthy()
  })

  it('shows a team still in the Final before it is played', () => {
    const pending = board.map((g) => (g.num === 92 ? { ...g, score: undefined } : g))
    wrap(<PathPicker byNum={gamesByNum(pending)} />)
    fireEvent.change(document.querySelector('.path-select'), { target: { value: champion } })
    expect(screen.getByText(/In the Final/)).toBeInTheDocument()
  })

  it('shows a team playing right now on its route', () => {
    // A semi-finalist mid-game, with the Final and third-place not yet resolved.
    const live = board.map((g) => {
      if (g.num === 89) return { ...g, score: [40, 38], live: { clock: '3:00', period: 'Q2' } }
      if (g.num >= 90) return { ...g, t1: null, t2: null, score: undefined }
      return g
    })
    const team = num(live, 89).t1
    wrap(<PathPicker byNum={gamesByNum(live)} />)
    fireEvent.change(document.querySelector('.path-select'), { target: { value: team } })
    expect(screen.getByText(/Playing now/)).toBeInTheDocument()
  })

  it('renders the whole bracket with real teams and no placeholders', () => {
    wrap(<Bracket matches={board} tz={TZ} />)
    expect(screen.queryByText(/Winner Group/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Winner Game/)).not.toBeInTheDocument()
    expect(document.getElementById('bx-m92').textContent).toContain(champion)
  })

  it('marks the third-place game in the mobile list', () => {
    window.matchMedia = (q) => ({
      matches: q.includes('720'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    wrap(<Bracket matches={board} tz={TZ} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Final' }))
    expect(screen.getByText('Third-Place Game')).toBeInTheDocument()
    delete window.matchMedia
  })
})

describe('the mobile bracket jumping to a focused game', () => {
  it('switches round first, then scrolls', () => {
    window.matchMedia = (q) => ({
      matches: q.includes('720'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    const onFocusHandled = vi.fn()
    const board = resolveBracket(GAMES)
    wrap(<Bracket matches={board} tz={TZ} focusMatch={89} onFocusHandled={onFocusHandled} />)
    expect(screen.getByRole('tab', { name: /Semi-Final/ })).toHaveAttribute('aria-selected', 'true')
    expect(onFocusHandled).toHaveBeenCalled()
    delete window.matchMedia
  })

  it('opens on the Final once every round is decided', () => {
    window.matchMedia = (q) => ({
      matches: q.includes('720'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    wrap(<Bracket matches={playedOut()} tz={TZ} />)
    expect(screen.getByRole('tab', { name: 'Final' })).toHaveAttribute('aria-selected', 'true')
    delete window.matchMedia
  })
})

describe('abandoned and awarded games', () => {
  const abandoned = { ...num(GAMES, 1), voided: true, statusLabel: 'Abandoned', score: [40, 38] }
  const canceled = { ...num(GAMES, 1), voided: true, statusLabel: 'Canceled' }
  const awarded = { ...num(GAMES, 1), score: [20, 0], awarded: true }

  it('warns on an abandoned or canceled game, and pauses on a postponement', () => {
    const a = wrap(<MatchCard match={abandoned} tz={TZ} />)
    expect(screen.getByText(/⚠ Abandoned/)).toBeInTheDocument()
    a.unmount()

    const c = wrap(<MatchCard match={canceled} tz={TZ} />)
    expect(screen.getByText(/⚠ Canceled/)).toBeInTheDocument()
    c.unmount()

    wrap(<MatchCard match={{ ...canceled, statusLabel: 'Postponed' }} tz={TZ} />)
    expect(screen.getByText(/⏸ Postponed/)).toBeInTheDocument()
  })

  it('shows the same states in the detail modal', () => {
    const a = wrap(<MatchDetail match={abandoned} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getAllByText(/Abandoned/).length).toBeGreaterThan(0)
    a.unmount()

    wrap(<MatchDetail match={awarded} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getByText(/awarded/i)).toBeInTheDocument()
  })

  it('shows the same states in the bracket', () => {
    const board = resolveBracket(
      GAMES.map((g) =>
        g.num === 85
          ? { ...g, t1: 'Spain', t2: 'Nigeria', voided: true, statusLabel: 'Abandoned', score: [40, 38] }
          : g,
      ),
    )
    wrap(<Bracket matches={board} tz={TZ} />)
    expect(document.getElementById('bx-m85').textContent).toMatch(/⚠ Abandoned/)
  })

  it('shows a delayed badge when the clock has passed with no ESPN clock', () => {
    const past = { ...num(GAMES, 1), ko: new Date(Date.now() - 30 * 60_000).toISOString() }
    wrap(<MatchCard match={past} tz={TZ} />)
    expect(screen.getByText(/⏸ Delayed/)).toBeInTheDocument()
  })

  it('shows a per-game note beside the tip-off when one is set', () => {
    wrap(<MatchCard match={{ ...num(GAMES, 1), note: 'venue change' }} tz={TZ} />)
    expect(screen.getByText(/venue change/)).toBeInTheDocument()
  })
})

describe('spoiler-free and follow paths in the detail modal', () => {
  const played = { ...num(GAMES, 1), score: [88, 61] }

  it('hides the score behind a reveal', () => {
    wrap(<MatchDetail match={played} tz={TZ} hideScores allMatches={GAMES} onClose={() => {}} />)
    expect(document.body.textContent).not.toMatch(/88/)
    fireEvent.click(screen.getByRole('button', { name: /^🙈 reveal$/ }))
    expect(document.body.textContent).toMatch(/88/)
  })

  it('stars a team from the modal', () => {
    wrap(<MatchDetail match={played} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow Italy' }))
    expect(screen.getByRole('button', { name: 'Unfollow Italy' })).toBeInTheDocument()
  })

  it('offers no star for an unresolved bracket slot', () => {
    wrap(<MatchDetail match={num(GAMES, 89)} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /^Follow / })).not.toBeInTheDocument()
  })

  it('notes a single overtime as well as several', () => {
    const one = wrap(
      <MatchDetail match={{ ...played, score: [95, 92], ot: 1 }} tz={TZ} allMatches={GAMES} onClose={() => {}} />,
    )
    expect(screen.getByText('after overtime')).toBeInTheDocument()
    one.unmount()

    wrap(
      <MatchDetail match={{ ...played, score: [99, 96], ot: 3 }} tz={TZ} allMatches={GAMES} onClose={() => {}} />,
    )
    expect(screen.getByText('after 3 overtimes')).toBeInTheDocument()
  })

  it('shows an overtime record and a current run in the tale of the tape', () => {
    const withOt = playedOut().map((g) => (g.stage === 'R1' ? { ...g, ot: 1 } : g))
    const sf = num(withOt, 89)
    wrap(<MatchDetail match={sf} tz={TZ} allMatches={withOt} onClose={() => {}} />)
    expect(screen.getByText('Overtime games')).toBeInTheDocument()
    expect(screen.getByText('Current run')).toBeInTheDocument()
    expect(screen.getAllByText(/in OT/).length).toBeGreaterThan(0)
  })

  it('renders nothing without a game', () => {
    const { container } = wrap(<MatchDetail match={null} tz={TZ} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('NextMatch late states', () => {
  beforeEach(() => pinClock())
  afterEach(() => vi.useRealTimers())

  it('prefers a followed team among several live games', () => {
    localStorage.setItem('fmwc:followed', JSON.stringify(['Italy']))
    // Italy plays in Group E; make two first-round games live including Italy's.
    const italyGame = GAMES.find((g) => g.stage === 'R1' && (g.t1 === 'Italy' || g.t2 === 'Italy'))
    const other = GAMES.find((g) => g.stage === 'R1' && g.num !== italyGame.num)
    const live = GAMES.map((g) =>
      [italyGame.num, other.num].includes(g.num)
        ? { ...g, score: [40, 38], live: { clock: '3:00', period: 'Q2' } }
        : g,
    )
    wrap(<NextMatch matches={live} tz={TZ} />)
    expect(screen.getAllByText('Italy').length).toBeGreaterThan(0)
  })

  it('shows a paused game as delayed rather than as a countdown', () => {
    const delayed = GAMES.map((g) =>
      g.num === 1 ? { ...g, score: [40, 38], live: { delayed: true, label: 'Suspended' } } : g,
    )
    wrap(<NextMatch matches={delayed} tz={TZ} />)
    expect(screen.getAllByText(/Suspended/).length).toBeGreaterThan(0)
  })

  it('falls back to "Delayed" when the feed gives no label', () => {
    const delayed = GAMES.map((g) =>
      g.num === 1 ? { ...g, score: [40, 38], live: { delayed: true } } : g,
    )
    wrap(<NextMatch matches={delayed} tz={TZ} />)
    expect(screen.getAllByText(/Delayed/).length).toBeGreaterThan(0)
  })

  it('names the stage of a knockout game rather than a group', () => {
    const board = playedOut().map((g) =>
      g.num === 92 ? { ...g, score: undefined, ko: new Date(Date.now() + 3600_000).toISOString() } : g,
    )
    wrap(<NextMatch matches={board} tz={TZ} />)
    expect(screen.getByText(/Final/)).toBeInTheDocument()
  })
})

describe('small rendering details', () => {
  it('says "1 game" for a single result', () => {
    render(
      <Filters
        filters={{ search: '', stages: [], group: 'all', team: 'all', venue: 'all', timeframe: 'all', myTeams: false, onMyServices: false }}
        setFilters={() => {}}
        tz={TZ}
        setTz={() => {}}
        detectedTz={TZ}
        resultCount={1}
      />,
    )
    expect(document.querySelector('.result-count').textContent).toBe('1 game')
  })

  it('falls back to "Delayed" in the live badge with no label', () => {
    render(<LiveBadge match={{ live: { delayed: true } }} />)
    expect(document.body.textContent).toMatch(/Delayed/)
  })

  it('has no free-to-air tag, since this edition has none', () => {
    wrap(<MatchCard match={num(GAMES, 1)} tz={TZ} />)
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    expect(screen.queryByText('free')).not.toBeInTheDocument()
  })

  it('names the services a viewer has on the card’s watch panel', () => {
    localStorage.setItem('fmwc:services', JSON.stringify(['hbomax']))
    // Give the game a platform the viewer has so the personalized line appears.
    wrap(<MatchCard match={{ ...num(GAMES, 1), tv: ['HBO Max'] }} tz={TZ} />)
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    expect(screen.getByText(/On your services:/)).toBeInTheDocument()
  })

  it('downloads a game from the card', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    global.URL.createObjectURL = vi.fn(() => 'blob:x')
    global.URL.revokeObjectURL = vi.fn()
    wrap(<MatchCard match={num(GAMES, 1)} tz={TZ} />)
    fireEvent.click(screen.getByRole('button', { name: /Add to calendar/ }))
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })

  it('shows both candidate pairs with a "vs" between them', () => {
    // Game 91 is "Loser Game 89" v "Loser Game 90"; resolve both semis.
    const board = GAMES.map((g) => {
      if (g.num === 89) return { ...g, t1: 'Japan', t2: 'Spain' }
      if (g.num === 90) return { ...g, t1: 'Italy', t2: 'China' }
      return g
    })
    wrap(<Bracket matches={board} tz={TZ} />)
    const g91 = document.getElementById('bx-m91')
    expect(within(g91).getAllByText(/Japan|Spain|Italy|China/).length).toBe(4)
    expect(g91.querySelector('.bx-vs-divider')).toBeTruthy()
  })
})

describe('WeekView late states', () => {
  const played = allGroupsPlayed()
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-08-28T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a score with overtime, and a followed team highlighted', () => {
    localStorage.setItem('fmwc:followed', JSON.stringify(['United States']))
    const ot = played.map((g) => (g.num === 1 ? { ...g, ot: 2 } : g))
    wrap(<WeekView allMatches={ot} shown={ot} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/80–70 2OT/)
    expect(document.querySelector('.wc-name.followed')).toBeTruthy()

    const one = played.map((g) => (g.num === 1 ? { ...g, ot: 1 } : g))
    wrap(<WeekView allMatches={one} shown={one} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/80–70 OT/)
  })

  it('shows a live badge, an abandoned pill and an awarded note', () => {
    const live = played.map((g) => (g.num === 1 ? { ...g, live: { clock: '3:00', period: 'Q2' } } : g))
    const a = wrap(<WeekView allMatches={live} shown={live} tz={TZ} dayHidden={() => false} />)
    expect(document.querySelector('.wc-live')).toBeTruthy()
    a.unmount()

    const voided = played.map((g) => (g.num === 1 ? { ...g, voided: true, statusLabel: 'Abandoned' } : g))
    const b = wrap(<WeekView allMatches={voided} shown={voided} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/⚠ Abandoned/)
    b.unmount()

    const awarded = played.map((g) => (g.num === 1 ? { ...g, awarded: true } : g))
    wrap(<WeekView allMatches={awarded} shown={awarded} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/awarded/)
  })

  it('counts a single game in the singular', () => {
    const one = [num(GAMES, 1)]
    wrap(<WeekView allMatches={one} shown={one} tz={TZ} dayHidden={() => false} />)
    expect(document.querySelector('.week-count').textContent).toMatch(/1 game$/)
  })

  it('treats a missing dayHidden as "show the scores"', () => {
    wrap(<WeekView allMatches={played} shown={played} tz={TZ} />)
    expect(document.body.textContent).toMatch(/80–70/)
  })
})

describe('WeekView knockout cells', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-09-09T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('expands a feed slot to its candidate pair in a cell', () => {
    // Game 89 (SF) is Winner Game 85 v Winner Game 87; resolve game 85.
    const resolved85 = { ...num(GAMES, 85), t1: 'Australia', t2: 'Italy' }
    const board = [resolved85, num(GAMES, 89)]
    wrap(<WeekView allMatches={board} shown={board} tz={TZ} dayHidden={() => false} />)
    expect(document.querySelectorAll('.feeder-cand').length).toBeGreaterThan(0)
    expect(document.body.textContent).toMatch(/Australia/)
    expect(document.body.textContent).toMatch(/Italy/)
  })

  it('names a knockout game by its slot label', () => {
    const board = [num(GAMES, 85)]
    wrap(<WeekView allMatches={board} shown={board} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/Winner Group I/)
  })
})

describe('Standings projection edges', () => {
  // Decisive first-round results, so the bottom two of each group are eliminated.
  const board = playStage('R1')

  it('opens the group pop-up for an advanced team', () => {
    const clinch = computeClinch(board)
    wrap(<Standings matches={board} tz={TZ} clinch={clinch} />)
    const advanced = Object.entries(clinch).find(([, v]) => v === 'advanced' || v === 'won-group')[0]
    expect(advanced).toBeTruthy()
    fireEvent.click(screen.getAllByTitle(/Show Group . games/)[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('projects each first-round group’s top two into their second round', () => {
    const clinch = computeClinch(board)
    wrap(<Standings matches={board} tz={TZ} clinch={clinch} />)
    expect(screen.getAllByText(/2nd round · Group [IJKL]/).length).toBeGreaterThan(0)
  })

  it('badges advanced and eliminated teams', () => {
    const clinch = computeClinch(board)
    wrap(<Standings matches={board} tz={TZ} clinch={clinch} />)
    expect(screen.getAllByText(/Advanced|Won group/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Eliminated/).length).toBeGreaterThan(0)
  })
})
