// The remaining views, modals and shared plumbing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { GAMES } from './fixtures/pretournament-games.js'
import { gamesByNum } from '../src/utils/bracket.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import WeekView from '../src/components/WeekView.jsx'
import DayMatchesModal from '../src/components/DayMatchesModal.jsx'
import GroupGamesModal from '../src/components/GroupGamesModal.jsx'
import CalendarModal from '../src/components/CalendarModal.jsx'
import FeederPair from '../src/components/FeederPair.jsx'
import PathPicker from '../src/components/PathPicker.jsx'
import LiveBadge from '../src/components/LiveBadge.jsx'
import NextMatch from '../src/components/NextMatch.jsx'
import Filters from '../src/components/Filters.jsx'
import { FollowProvider, useFollow } from '../src/context/follow.jsx'
import { PathProvider, usePath } from '../src/context/path.jsx'
import { DetailContext } from '../src/context/detail.js'
import { DEFAULT_FILTERS } from '../src/utils/urlState.js'
import { pinClock, withGroupScores, playStage } from './helpers/tournament.js'

const TZ = 'Asia/Manila'
const num = (n) => GAMES.find((g) => g.num === n)

function wrap(ui, { onDetail = () => {} } = {}) {
  return render(
    <FollowProvider>
      <PathProvider>
        <DetailContext.Provider value={onDetail}>{ui}</DetailContext.Provider>
      </PathProvider>
    </FollowProvider>,
  )
}

beforeEach(() => localStorage.clear())

describe('WeekView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2023-08-28T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('lays the tournament out as a calendar of days', () => {
    wrap(<WeekView allMatches={GAMES} shown={GAMES} tz={TZ} dayHidden={() => false} />)
    expect(document.querySelector('.weekview')).toBeTruthy()
    expect(document.querySelectorAll('.week-cell').length).toBeGreaterThan(0)
  })

  it('shows a legend and colors each cell', () => {
    wrap(<WeekView allMatches={GAMES} shown={GAMES} tz={TZ} dayHidden={() => false} />)
    expect(document.querySelector('.week-legend')).toBeTruthy()
    expect(document.querySelectorAll('.lg-item').length).toBeGreaterThan(0)
  })

  it('never renders the epoch for a tip-off, and every 2023 game shows a real time', () => {
    wrap(<WeekView allMatches={GAMES} shown={GAMES} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).not.toMatch(/1970|1969/)
    // Every game of this edition has a set tip-off, so no cell reads TBC.
    const times = [...document.querySelectorAll('.wc-time')].map((n) => n.textContent)
    expect(times.filter((t) => t === 'TBC')).toHaveLength(0)
    expect(times.length).toBeGreaterThan(0)
  })
})

describe('DayMatchesModal', () => {
  const day = GAMES.filter((g) => g.ko?.startsWith('2023-08-26'))

  it('lists a day’s games and closes', () => {
    const onClose = vi.fn()
    wrap(
      <DayMatchesModal
        matches={day}
        dayKey="2023-08-26"
        tz={TZ}
        byNum={gamesByNum(GAMES)}
        onClose={onClose}
      />,
    )
    expect(screen.getAllByText('United States').length).toBeGreaterThan(0)
    expect(screen.getByText('Saturday, August 26')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('titles the day from the day key and shows real tip-off times', () => {
    wrap(
      <DayMatchesModal
        matches={day}
        dayKey="2023-08-26"
        tz={TZ}
        byNum={gamesByNum(GAMES)}
        onClose={() => {}}
      />,
    )
    expect(document.body.textContent).not.toMatch(/December 31|1969|1970/)
    expect(screen.queryAllByText('TBC')).toHaveLength(0)
  })

  it('falls back to a generic title with no day to name', () => {
    wrap(<DayMatchesModal matches={[]} tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />)
    expect(screen.getByText('Schedule')).toBeInTheDocument()
  })
})

describe('GroupGamesModal', () => {
  // A complete first-round Group A (Italy, Dominican Republic, Philippines, Angola).
  const board = withGroupScores(
    'A',
    [
      ['Italy', 'Angola', 81, 67],
      ['Dominican Republic', 'Philippines', 87, 81],
      ['Italy', 'Dominican Republic', 82, 87],
      ['Philippines', 'Angola', 70, 80],
      ['Angola', 'Dominican Republic', 67, 75],
      ['Philippines', 'Italy', 83, 90],
    ],
    GAMES,
  )

  it('lists a group’s six games', () => {
    wrap(<GroupGamesModal group="A" matches={board} tz={TZ} onClose={() => {}} />)
    expect(
      screen.getAllByText(/Italy|Dominican Republic|Philippines|Angola/).length,
    ).toBeGreaterThan(5)
  })

  it('shows a team’s locked quarter-final opponent', () => {
    wrap(
      <GroupGamesModal
        group="A"
        team="Italy"
        matches={board}
        tz={TZ}
        knockout={{
          status: 'ko',
          opponent: 'Spain',
          opponentLabel: null,
          round: 'QF',
          matchNum: 85,
          settled: true,
        }}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Quarter-final')).toBeInTheDocument()
    expect(screen.getByText('Spain')).toBeInTheDocument()
    expect(screen.getByText('Game 85')).toBeInTheDocument()
    expect(screen.getByText(/reached the quarter-finals/)).toBeInTheDocument()
    expect(screen.getByText(/confirmed/)).toBeInTheDocument()
  })

  it('shows a projected (not yet confirmed) quarter-final matchup', () => {
    wrap(
      <GroupGamesModal
        group="A"
        team="Italy"
        matches={board}
        tz={TZ}
        knockout={{
          status: 'ko',
          opponent: 'Spain',
          opponentLabel: null,
          round: 'QF',
          matchNum: 85,
          settled: false,
        }}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText(/currently projected to play/)).toBeInTheDocument()
    expect(screen.getByText(/the opponent can still change/)).toBeInTheDocument()
  })

  it('renders no knockout section when the team has no locked opponent', () => {
    wrap(<GroupGamesModal group="A" team="United States" matches={board} tz={TZ} onClose={() => {}} />)
    expect(document.querySelector('.gg-knockout')).toBeNull()
  })
})

describe('CalendarModal', () => {
  it('offers the export buttons and closes', () => {
    const onClose = vi.fn()
    wrap(<CalendarModal matches={GAMES} filtered={GAMES.slice(0, 3)} onClose={onClose} />)
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('downloads a whole-tournament .ics', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    global.URL.createObjectURL = vi.fn(() => 'blob:x')
    global.URL.revokeObjectURL = vi.fn()
    wrap(<CalendarModal matches={GAMES} filtered={GAMES} onClose={() => {}} />)
    const all = screen.getAllByRole('button').find((b) => /All games/i.test(b.textContent))
    fireEvent.click(all)
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })

  it('adds a My-teams row and download once a team is followed', () => {
    localStorage.setItem('fmwc:followed', JSON.stringify(['Spain']))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    global.URL.createObjectURL = vi.fn(() => 'blob:x')
    global.URL.revokeObjectURL = vi.fn()
    wrap(<CalendarModal matches={GAMES} filtered={GAMES} onClose={() => {}} />)
    const mine = screen.getAllByRole('button').find((b) => /My teams/i.test(b.textContent))
    expect(mine).toBeTruthy()
    fireEvent.click(mine)
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })
})

describe('FeederPair', () => {
  it('shows both candidate teams', () => {
    wrap(<FeederPair feeder={{ a: 'Australia', b: 'Italy', kind: 'Winner', num: 89 }} />)
    expect(screen.getByText('Australia')).toBeInTheDocument()
    expect(screen.getByText('Italy')).toBeInTheDocument()
  })
})

describe('PathPicker', () => {
  it('offers no route while nobody has reached the knockout', () => {
    const { container } = wrap(<PathPicker byNum={gamesByNum(GAMES)} />)
    expect(container.querySelector('.path-select')).toBeNull()
  })

  it('traces a team once it is in the bracket', () => {
    // Put real teams into a quarter-final so knockoutTeams() has candidates.
    const board = resolveBracket(
      GAMES.map((g) => (g.num === 85 ? { ...g, t1: 'United States', t2: 'Spain' } : g)),
    )
    wrap(<PathPicker byNum={gamesByNum(board)} />)
    const select = document.querySelector('.path-select')
    expect(select).toBeTruthy()
    fireEvent.change(select, { target: { value: 'United States' } })
    expect(select.value).toBe('United States')
    // A status line appears for the picked team.
    expect(document.querySelector('.path-status')).toBeTruthy()
  })
})

describe('LiveBadge', () => {
  it('shows the period and clock while a game is running', () => {
    render(<LiveBadge match={{ live: { clock: '3:20', period: 'Q2' } }} />)
    expect(document.body.textContent).toMatch(/3:20|Q2/)
  })

  it('shows a delay instead of a clock when the game is paused', () => {
    render(<LiveBadge match={{ live: { delayed: true, label: 'Suspended' } }} />)
    expect(document.body.textContent).toMatch(/Suspended|Delayed/)
  })

  it('renders nothing when the game is not live', () => {
    const { container } = render(<LiveBadge match={{}} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('NextMatch', () => {
  afterEach(() => vi.useRealTimers())

  it('counts down to the first game of the tournament', () => {
    pinClock()
    wrap(<NextMatch matches={GAMES} tz={TZ} />)
    expect(document.querySelector('.nm-label').textContent).toMatch(/Next game/)
    expect(document.querySelector('.nm-label').textContent).not.toMatch(/matches/)
    const soonest = [...GAMES].filter((g) => g.ko).sort((a, b) => new Date(a.ko) - new Date(b.ko))[0]
    expect(screen.getAllByText(soonest.t1).length).toBeGreaterThan(0)
    // A few hours out: hours/minutes/seconds, no days chunk.
    expect(document.querySelector('.nm-countdown').textContent).not.toMatch(/d/)
  })

  it('counts the days as well, from further out', () => {
    pinClock(new Date('2023-08-20T09:00:00+08:00'))
    wrap(<NextMatch matches={GAMES} tz={TZ} />)
    expect(document.querySelector('.nm-countdown').textContent).toMatch(/^\d+d/)
  })

  it('shows nothing once the whole tournament is in the past', () => {
    const past = GAMES.map((g) => ({
      ...g,
      ko: g.ko ? g.ko.replace('2023-08', '2020-08').replace('2023-09', '2020-09') : g.ko,
      score: [80, 70],
    }))
    wrap(<NextMatch matches={past} tz={TZ} />)
    expect(screen.getByText(/tournament has concluded/)).toBeInTheDocument()
  })
})

describe('Filters', () => {
  const setup = (filters = DEFAULT_FILTERS) => {
    const setFilters = vi.fn()
    const setTz = vi.fn()
    wrap(
      <Filters
        filters={filters}
        setFilters={setFilters}
        tz={TZ}
        setTz={setTz}
        detectedTz={TZ}
        resultCount={92}
      />,
    )
    return { setFilters, setTz }
  }

  it('offers a group, team and stage filter', () => {
    setup()
    const labels = [...document.querySelectorAll('.field')].map((f) =>
      f.textContent.split(/\s{2,}/)[0].trim(),
    )
    expect(labels.join(' ')).toMatch(/Group/)
    expect(labels.join(' ')).toMatch(/Team/)
  })

  it('reports the count in games', () => {
    setup()
    expect(document.querySelector('.result-count').textContent).toBe('92 games')
  })

  it('lists the stages this edition plays', () => {
    setup()
    const text = document.body.textContent
    expect(text).toMatch(/First Round/)
    expect(text).toMatch(/Quarter/)
    expect(text).not.toMatch(/Round of 16/)
  })

  it('pushes a change up', () => {
    const { setFilters } = setup()
    const groupField = [...document.querySelectorAll('.field')].find((f) =>
      f.textContent.startsWith('Group'),
    )
    fireEvent.change(groupField.querySelector('select'), { target: { value: 'B' } })
    expect(setFilters).toHaveBeenCalled()
  })
})

describe('follow context', () => {
  it('stars and unstars a team, persisting under this app’s key', () => {
    const { result } = renderHook(() => useFollow(), { wrapper: FollowProvider })
    expect(result.current.isFollowed('Japan')).toBe(false)
    act(() => result.current.toggle('Japan'))
    expect(result.current.isFollowed('Japan')).toBe(true)
    expect(result.current.count).toBe(1)
    expect(localStorage.getItem('fmwc:followed')).toContain('Japan')
    act(() => result.current.toggle('Japan'))
    expect(result.current.isFollowed('Japan')).toBe(false)
  })
})

describe('path context', () => {
  it('sets and clears the traced team', () => {
    const { result } = renderHook(() => usePath(), { wrapper: PathProvider })
    act(() => result.current.setPathTeam('Japan'))
    expect(result.current.pathTeam).toBe('Japan')
    act(() => result.current.setPathTeam(null))
    expect(result.current.pathTeam).toBeNull()
  })
})
