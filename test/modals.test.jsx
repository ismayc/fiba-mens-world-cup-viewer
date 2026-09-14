// The pop-ups and the Scenarios view, driven through their interactive paths.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'

vi.mock('../src/data/games.js', async (importOriginal) => ({
  ...(await importOriginal()),
  GAMES: (await import('./fixtures/pretournament-games.js')).GAMES,
}))

import { GAMES } from './fixtures/pretournament-games.js'
import { gamesByNum } from '../src/utils/bracket.js'
import CalendarModal from '../src/components/CalendarModal.jsx'
import ChampionBanner from '../src/components/ChampionBanner.jsx'
import DayMatchesModal from '../src/components/DayMatchesModal.jsx'
import GroupGamesModal from '../src/components/GroupGamesModal.jsx'
import ScenariosView from '../src/components/ScenariosView.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { PathProvider } from '../src/context/path.jsx'
import { ServicesProvider } from '../src/context/services.jsx'
import { DetailContext } from '../src/context/detail.js'
import { allGroupsPlayed, withGroupScores } from './helpers/tournament.js'

const TZ = 'Asia/Qatar'
const num = (games, n) => games.find((g) => g.num === n)
// First-round Group A game numbers (United States, Greece, Dominican Republic, Nigeria).
const GA = GAMES.filter((g) => g.stage === 'R1' && g.group === 'A').map((g) => g.num)

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

const DECISIVE = [
  ['United States', 'Greece', 90, 60],
  ['United States', 'Dominican Republic', 90, 60],
  ['United States', 'Nigeria', 90, 60],
  ['Greece', 'Dominican Republic', 80, 70],
  ['Greece', 'Nigeria', 80, 70],
  ['Dominican Republic', 'Nigeria', 75, 70],
]
const PLAYED = withGroupScores('A', DECISIVE, GAMES)
const DAY1 = GAMES.filter((g) => g.ko?.startsWith('2027-08-27'))

beforeEach(() => localStorage.clear())

describe('CalendarModal', () => {
  it('copies the feed URL, and says so', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    wrap(<CalendarModal matches={GAMES} filtered={GAMES} onClose={() => {}} />)
    const copyBtn = screen.getAllByRole('button', { name: /Copy URL/ })[0]
    await act(async () => {
      fireEvent.click(copyBtn)
    })
    expect(writeText).toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: /Copied!/ }).length).toBeGreaterThan(0)
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getAllByRole('button', { name: /Copy URL/ }).length).toBeGreaterThan(0)
    vi.useRealTimers()
  })

  it('survives a browser with no clipboard access', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
      configurable: true,
    })
    wrap(<CalendarModal matches={GAMES} filtered={GAMES} onClose={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /Copy URL/ })[0])
    })
    expect(screen.getAllByRole('button', { name: /Copy URL/ }).length).toBeGreaterThan(0)
  })

  it('downloads the filtered set', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    global.URL.createObjectURL = vi.fn(() => 'blob:x')
    global.URL.revokeObjectURL = vi.fn()
    wrap(<CalendarModal matches={GAMES} filtered={GAMES.slice(0, 4)} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Current filter/ }))
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })
})

describe('ChampionBanner', () => {
  const decided = { ...num(GAMES, 92), t1: 'Australia', t2: 'Japan', score: [90, 80] }

  it('opens the Final when clicked', () => {
    const onDetail = vi.fn()
    wrap(<ChampionBanner match={decided} />, { onDetail })
    fireEvent.click(screen.getByTitle('Open the Final'))
    expect(onDetail).toHaveBeenCalledWith(decided)
  })

  it('stays hidden with no Final at all', () => {
    const { container } = wrap(<ChampionBanner match={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden when the winner is not a competing team', () => {
    const { container } = wrap(<ChampionBanner match={{ ...decided, t1: 'Atlantis' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden in spoiler-free mode', () => {
    const { container } = wrap(<ChampionBanner match={decided} hideScores />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('DayMatchesModal', () => {
  it('counts the day’s games and opens one', () => {
    const onDetail = vi.fn()
    wrap(<DayMatchesModal matches={DAY1} tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />, {
      onDetail,
    })
    expect(screen.getByText(/8 games/)).toBeInTheDocument()
    fireEvent.click(document.querySelectorAll('.dm-row')[0])
    expect(onDetail).toHaveBeenCalled()
  })

  it('says "1 game" for a single fixture', () => {
    wrap(<DayMatchesModal matches={[DAY1[0]]} tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />)
    expect(screen.getByText(/1 game$/)).toBeInTheDocument()
  })

  it('hides scores behind a reveal, then shows them', () => {
    const played = DAY1.map((g) => ({ ...g, score: [88, 61] }))
    wrap(
      <DayMatchesModal
        matches={played}
        tz={TZ}
        hideScores
        byNum={gamesByNum(GAMES)}
        onClose={() => {}}
      />,
    )
    expect(document.querySelectorAll('.gg-score-hidden').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Reveal scores/ }))
    expect(document.querySelectorAll('.gg-score-hidden')).toHaveLength(0)
  })

  it('shows a final score with overtime, a live badge, a void and a delay', () => {
    const board = [
      { ...DAY1[0], score: [95, 92], ot: 2 },
      { ...DAY1[1], score: [40, 38], live: { clock: '3:00', period: 'Q2' } },
      { ...DAY1[2], voided: true, statusLabel: 'Postponed' },
      { ...DAY1[3], ko: new Date(Date.now() - 30 * 60_000).toISOString() },
    ]
    wrap(<DayMatchesModal matches={board} tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />)
    expect(document.body.textContent).toMatch(/2OT/)
    expect(document.querySelector('.gg-badge.gg-final')).toBeTruthy()
    expect(document.querySelector('.wc-live, .badge-live')).toBeTruthy()
    expect(document.querySelector('.gg-badge.gg-voided')).toBeTruthy()
    expect(document.querySelector('.gg-badge.gg-delayed')).toBeTruthy()
  })

  it('names a knockout game and expands its candidate pairs', () => {
    // Game 89 is "Winner Game 85" v "Winner Game 87"; resolve game 85 so side one
    // expands to its candidate pair.
    const resolved = gamesByNum(
      GAMES.map((g) => (g.num === 85 ? { ...g, t1: 'Australia', t2: 'Italy' } : g)),
    )
    wrap(<DayMatchesModal matches={[num(GAMES, 89)]} tz={TZ} byNum={resolved} onClose={() => {}} />)
    expect(screen.getByText('Australia')).toBeInTheDocument()
    expect(document.querySelectorAll('.feeder-cand').length).toBe(2)
    expect(screen.getByText(/Semi-Final/)).toBeInTheDocument()
  })

  it('shows the bullet flag for an unresolved slot', () => {
    wrap(<DayMatchesModal matches={[num(GAMES, 89)]} tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />)
    expect(document.querySelectorAll('.gg-flag')[0].textContent).toBe('•')
  })
})

describe('GroupGamesModal', () => {
  it('opens a game and closes the pop-up behind it', () => {
    const onDetail = vi.fn()
    const onClose = vi.fn()
    wrap(<GroupGamesModal group="A" matches={PLAYED} tz={TZ} onClose={onClose} />, { onDetail })
    fireEvent.click(document.querySelectorAll('.gg-fixture')[0])
    expect(onClose).toHaveBeenCalled()
    expect(onDetail).toHaveBeenCalled()
  })

  it('hides scores behind a reveal', () => {
    wrap(<GroupGamesModal group="A" matches={PLAYED} tz={TZ} hideScores onClose={() => {}} />)
    expect(document.querySelectorAll('.gg-score-hidden').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: /Reveal scores/ }))
    expect(document.querySelectorAll('.gg-score-hidden')).toHaveLength(0)
  })

  it('shows overtime, a live badge, a void and a delay', () => {
    const board = PLAYED.map((g) => {
      if (g.num === GA[0]) return { ...g, score: [95, 92], ot: 1 }
      if (g.num === GA[1]) return { ...g, score: [40, 38], live: { clock: '3:00', period: 'Q2' } }
      if (g.num === GA[2]) return { ...g, voided: true, statusLabel: 'Postponed', score: undefined }
      if (g.num === GA[3])
        return { ...g, score: undefined, ko: new Date(Date.now() - 30 * 60_000).toISOString() }
      return g
    })
    wrap(<GroupGamesModal group="A" matches={board} tz={TZ} onClose={() => {}} />)
    expect(document.body.textContent).toMatch(/\bOT\b/)
    expect(document.querySelector('.badge-live')).toBeTruthy()
    expect(document.querySelector('.gg-badge.gg-voided')).toBeTruthy()
    expect(document.querySelector('.gg-badge.gg-delayed')).toBeTruthy()
  })

  it('falls back to "Knockout" for an unrecognised round and TBD for a nameless opponent', () => {
    wrap(
      <GroupGamesModal
        group="A"
        team="United States"
        matches={PLAYED}
        tz={TZ}
        knockout={{ status: 'ko', opponent: null, round: 'XX', matchNum: 99, settled: false }}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText(/Knockout/)).toBeInTheDocument()
    expect(screen.getByText('To be determined')).toBeInTheDocument()
  })

  it('shows a bullet for a team with no flag', () => {
    wrap(
      <GroupGamesModal
        group="A"
        team="Atlantis"
        matches={PLAYED}
        tz={TZ}
        knockout={{ status: 'ko', opponent: 'Narnia', round: 'QF', matchNum: 85, settled: true }}
        onClose={() => {}}
      />,
    )
    expect(document.querySelectorAll('.gg-flag')[0].textContent).toBe('•')
  })
})

describe('ScenariosView', () => {
  it('steps a picked score up and down', () => {
    wrap(<ScenariosView matches={GAMES} />)
    const fixture = document.querySelector('.sc-fixture')
    fireEvent.click(within(fixture).getAllByRole('button')[0])
    const steppers = within(fixture).getAllByRole('button', { name: /minus|plus/ })
    const before = within(fixture).getByText(/\d+–\d+/).textContent
    fireEvent.click(steppers[1]) // +
    expect(within(fixture).getByText(/\d+–\d+/).textContent).not.toBe(before)
    fireEvent.click(steppers[0]) // −
    expect(within(fixture).getByText(/\d+–\d+/).textContent).toBe(before)
  })

  it('toggles a pick off when the same side is clicked twice', () => {
    wrap(<ScenariosView matches={GAMES} />)
    const fixture = document.querySelector('.sc-fixture')
    const [home] = within(fixture).getAllByRole('button')
    fireEvent.click(home)
    expect(fixture.querySelector('.sc-score')).toBeTruthy()
    fireEvent.click(within(document.querySelector('.sc-fixture')).getAllByRole('button')[0])
    expect(document.querySelector('.sc-fixture .sc-score')).toBeNull()
  })

  it('clears every pick', () => {
    wrap(<ScenariosView matches={GAMES} />)
    fireEvent.click(within(document.querySelector('.sc-fixture')).getAllByRole('button')[0])
    expect(document.querySelector('.sc-score')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Clear picks/i }))
    expect(document.querySelector('.sc-score')).toBeNull()
  })

  it('projects each group’s top two into their second-round group', () => {
    wrap(<ScenariosView matches={GAMES} />)
    // Every first-round group card names where its top two would head.
    expect(document.querySelectorAll('.sc-entry-row').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2nd round · Group [IJKL]/).length).toBeGreaterThan(0)
  })

  it('retires itself once every first-round group is decided', () => {
    const board = allGroupsPlayed((g) => g.t1)
    wrap(<ScenariosView matches={board} />)
    expect(screen.getByText(/Every group is decided/)).toBeInTheDocument()
  })

  it('flags a placing that only a drawing of lots could settle', () => {
    const lots = withGroupScores(
      'A',
      [
        ['United States', 'Nigeria', 80, 70],
        ['Dominican Republic', 'United States', 70, 80],
        ['Greece', 'Dominican Republic', 80, 70],
        ['Nigeria', 'Greece', 70, 80],
      ],
      GAMES,
    )
    wrap(<ScenariosView matches={lots} />)
    expect(document.querySelectorAll('.sc-tiebreak').length).toBeGreaterThan(0)
  })
})

describe('the last modal and scenario arms', () => {
  it('expands the FIRST side of a day row when that side is the feed', () => {
    // Game 91 is "Loser Game 89" v "Loser Game 90": resolve both so both expand.
    const resolved = gamesByNum(
      GAMES.map((g) => {
        if (g.num === 89) return { ...g, t1: 'Japan', t2: 'Spain' }
        if (g.num === 90) return { ...g, t1: 'Italy', t2: 'China' }
        return g
      }),
    )
    wrap(<DayMatchesModal matches={[num(GAMES, 91)]} tz={TZ} byNum={resolved} onClose={() => {}} />)
    expect(document.querySelectorAll('.feeder-cand')).toHaveLength(4)
  })

  it('shows a single overtime as "OT" in both pop-ups', () => {
    const one = { ...DAY1[0], score: [95, 92], ot: 1 }
    const a = wrap(
      <DayMatchesModal matches={[one]} tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />,
    )
    expect(document.querySelector('.gg-pens').textContent.trim()).toBe('OT')
    a.unmount()

    const board = PLAYED.map((g) => (g.num === GA[0] ? { ...g, score: [95, 92], ot: 3 } : g))
    wrap(<GroupGamesModal group="A" matches={board} tz={TZ} onClose={() => {}} />)
    expect(document.querySelector('.gg-pens').textContent.trim()).toBe('3OT')
  })

  it('falls back to "Schedule" when the day pop-up has no games', () => {
    wrap(<DayMatchesModal matches={[]} tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />)
    expect(screen.getByText('Schedule')).toBeInTheDocument()
  })

  it('shows a bullet for a group-game side with no flag', () => {
    const bogus = PLAYED.map((g) => (g.num === GA[0] ? { ...g, t1: 'Atlantis' } : g))
    wrap(<GroupGamesModal group="A" matches={bogus} tz={TZ} onClose={() => {}} />)
    expect([...document.querySelectorAll('.gg-flag')].some((e) => e.textContent === '•')).toBe(true)
  })
})

describe('ScenariosView remaining arms', () => {
  it('picks the away side, and highlights it', () => {
    wrap(<ScenariosView matches={GAMES} />)
    const fixture = document.querySelector('.sc-fixture')
    const [, away] = within(fixture).getAllByRole('button')
    fireEvent.click(away)
    expect(document.querySelector('.sc-pick.active')).toBeTruthy()
    expect(document.querySelector('.sc-fx-right.sc-win')).toBeTruthy()
  })

  it('steps the away team’s score', () => {
    wrap(<ScenariosView matches={GAMES} />)
    const fixture = document.querySelector('.sc-fixture')
    fireEvent.click(within(fixture).getAllByRole('button')[0])
    const plus = within(document.querySelector('.sc-fixture')).getAllByRole('button', {
      name: /plus/,
    })
    fireEvent.click(plus[plus.length - 1])
    expect(document.querySelector('.sc-score-dash').textContent).toMatch(/78–71/)
  })

  it('counts what is still open, and how many orders each group can still take', () => {
    wrap(<ScenariosView matches={GAMES} />)
    expect(screen.getByText(/48 games still open/)).toBeInTheDocument()
    // Eight untouched groups of four: 24 orderings each.
    expect(screen.getAllByText('24 possible orders')).toHaveLength(8)
  })

  // Group A is arranged so its one remaining game (game 1, United States v Nigeria)
  // cannot change any position: the order is decided with a game still to play.
  const decidedBoard = () => {
    let board = allGroupsPlayed()
    board = withGroupScores(
      'A',
      [
        ['United States', 'Greece', 90, 60],
        ['United States', 'Dominican Republic', 90, 60],
        ['Greece', 'Dominican Republic', 80, 70],
        ['Greece', 'Nigeria', 80, 70],
        ['Dominican Republic', 'Nigeria', 80, 70],
      ],
      board,
    )
    return board.map((g) => (g.num === 1 ? { ...g, score: undefined } : g))
  }

  it('says "1 game still open" in the singular', () => {
    wrap(<ScenariosView matches={decidedBoard()} />)
    expect(screen.getByText(/1 game still open/)).toBeInTheDocument()
  })

  it('labels a decided group’s table as final and marks it decided', () => {
    wrap(<ScenariosView matches={decidedBoard()} />)
    expect(screen.getAllByText('order decided').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Projected/).length).toBeGreaterThan(0)
    expect(document.querySelector('.sc-decided')).toBeTruthy()
  })

  it('shows a bullet for a fixture side with no flag', () => {
    const bogus = GAMES.map((g) => (g.num === 1 ? { ...g, t1: 'Atlantis', t2: 'Narnia' } : g))
    wrap(<ScenariosView matches={bogus} />)
    expect(
      [...document.querySelectorAll('.sc-fx-team')].some((e) => e.textContent.includes('•')),
    ).toBe(true)
  })
})
