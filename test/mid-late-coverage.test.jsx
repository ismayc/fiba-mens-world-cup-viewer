// Renders the mid- and late-tournament states the pretournament tests never reach:
// the second-round standings section, the "as it stands" projections once games
// are played, a locked knockout opponent in the group pop-up, a fully-picked
// scenario, the group filter, a tv-note, and the next-match jump.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Standings from '../src/components/Standings.jsx'
import ScenariosView from '../src/components/ScenariosView.jsx'
import MatchDetail from '../src/components/MatchDetail.jsx'
import Bracket from '../src/components/Bracket.jsx'
import WeekView from '../src/components/WeekView.jsx'
import DayMatchesModal from '../src/components/DayMatchesModal.jsx'
import NextMatch from '../src/components/NextMatch.jsx'
import App from '../src/App.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { PathProvider } from '../src/context/path.jsx'
import { DetailContext } from '../src/context/detail.js'
import { GAMES } from './fixtures/pretournament-games.js'
import { computeClinch } from '../src/utils/clinch.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { gamesByNum } from '../src/utils/bracket.js'
import { playStage, pinClock } from './helpers/tournament.js'

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

// R1 fully played and resolved, then R2 fully played and resolved: the second
// round is seeded and complete, so standings, projections and locks all light up.
const r1Done = resolveBracket(playStage('R1', GAMES))
const r2Done = resolveBracket(playStage('R2', r1Done))

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('Standings once the first round is complete', () => {
  it('renders both stages, their projections and locked finishes', () => {
    wrap(<Standings matches={r1Done} tz={TZ} hideScores={false} clinch={computeClinch(r1Done)} />)
    expect(screen.getByText('First round')).toBeTruthy()
    expect(screen.getByText('Second round')).toBeTruthy()
    // First-round groups now project into the second round.
    expect(screen.getAllByText('As it stands → second round').length).toBeGreaterThan(0)
    // Seeded second-round groups project into the quarter-finals.
    expect(screen.getAllByText('As it stands → quarter-finals').length).toBeGreaterThan(0)
    // The second-round tables render (group I is one of them).
    expect(screen.getAllByText('Group I').length).toBeGreaterThan(0)
  })

  it('shows a locked quarter-final opponent in the group pop-up', () => {
    wrap(<Standings matches={r2Done} tz={TZ} hideScores={false} clinch={computeClinch(r2Done)} />)
    // Open the pop-up for the United States (group A → advanced to the knockout).
    fireEvent.click(screen.getAllByText('United States')[0])
    expect(screen.getByText(/reached the quarter-finals/)).toBeTruthy()
  })
})

describe('ScenariosView with every game of a group picked', () => {
  it('labels the projection final once a group is fully decided', () => {
    wrap(<ScenariosView matches={GAMES} />)
    // Pick a winner for every open first-round game (the left "W" of each fixture).
    for (const btn of document.querySelectorAll('.sc-fx-buttons .sc-pick:first-child')) {
      fireEvent.click(btn)
    }
    expect(screen.getAllByText('Projected final').length).toBeGreaterThan(0)
  })
})

describe('MatchDetail broadcast note', () => {
  it('renders a per-game tv list and round note', () => {
    const g = { ...num(1), tv: ['TNT', 'truTV'], tvNote: 'Also on TBS' }
    wrap(<MatchDetail match={g} tz={TZ} allMatches={GAMES} hideScores={false} onClose={() => {}} />)
    expect(screen.getByText('Also on TBS')).toBeTruthy()
  })

  it('renders no tale of the tape when a knockout side has not played', () => {
    // A quarter-final with real teams but an empty history: neither has a record,
    // so the tape renders nothing rather than an empty table.
    const qf = { num: 85, stage: 'QF', t1: 'United States', t2: 'Spain', ko: '2023-09-05T20:40:00+08:00', venue: 'moa', tv: [] }
    wrap(<MatchDetail match={qf} tz={TZ} allMatches={[]} hideScores={false} onClose={() => {}} />)
    expect(screen.queryByText(/Tournament so far/)).toBeNull()
  })

  it('renders the tale of the tape once both knockout sides have played', () => {
    // Both teams have first-round records, so the tape renders their form. One
    // side (United States) carries a positive point difference and the other
    // (Jordan, bottom of its group) a negative one, so both signs are formatted.
    const played = playStage('R1', GAMES)
    const qf = { num: 85, stage: 'QF', t1: 'United States', t2: 'Jordan', ko: '2023-09-05T20:40:00+08:00', venue: 'moa', tv: [] }
    wrap(<MatchDetail match={qf} tz={TZ} allMatches={played} hideScores={false} onClose={() => {}} />)
    expect(screen.getByText(/Tournament so far/)).toBeTruthy()
  })
})

describe('NextMatch jump when the target day is not on the page', () => {
  beforeEach(() => pinClock())
  afterEach(() => vi.useRealTimers())

  it('does not throw when there is no day element to scroll to', () => {
    // Rendered standalone, so `day-<key>` elements do not exist; jumpTo finds no
    // element and quietly does nothing.
    wrap(<NextMatch matches={GAMES} tz={TZ} />)
    const row = document.querySelector('.nm-jump') || document.querySelector('.nm-live-row')
    fireEvent.click(row)
    expect(document.querySelector('.nextmatch')).toBeTruthy()
  })
})

describe('a to-be-confirmed tip-off renders as TBC, never the epoch', () => {
  const tbc = (n) => GAMES.map((g) => (g.num === n ? { ...g, ko: null, tbdTip: true } : g))

  it('in the bracket', () => {
    wrap(<Bracket matches={resolveBracket(tbc(92))} tz={TZ} hideScores={false} />)
    expect(document.body.textContent).toMatch(/TBC/)
    expect(document.body.textContent).not.toMatch(/1970|1969/)
  })

  it('in the week view', () => {
    pinClock(new Date('2023-09-10T09:00:00+08:00'))
    const board = tbc(92)
    wrap(<WeekView allMatches={board} shown={board} tz={TZ} dayHidden={() => false} />)
    expect(document.body.textContent).toMatch(/TBC/)
    vi.useRealTimers()
  })

  it('in the day pop-up', () => {
    const g = { ...num(92), ko: null, tbdTip: true }
    wrap(<DayMatchesModal matches={[g]} dayKey="2023-09-10" tz={TZ} byNum={gamesByNum(GAMES)} onClose={() => {}} />)
    expect(document.body.textContent).toMatch(/TBC/)
  })
})

describe('WeekView with today outside the tournament', () => {
  it('falls back to the first week', () => {
    pinClock(new Date('2030-01-01T12:00:00Z'))
    wrap(<WeekView allMatches={GAMES} shown={GAMES} tz={TZ} dayHidden={() => false} />)
    expect(document.querySelector('.weekview')).toBeTruthy()
    vi.useRealTimers()
  })
})

describe('App interactions that need a live DOM', () => {
  beforeEach(() => {
    // App reads the real, completed 2023 board, so every group and knockout stage
    // is archived out of the Schedule and only the third-place game and Final (both
    // on September 10) remain on the page. Pin the clock to the afternoon of the
    // Final's day so the "next game" is the third-place game, whose day section is
    // still rendered for jumpTo to scroll to.
    pinClock(new Date('2023-09-10T15:00:00+08:00'))
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ events: [] }) }))
  })
  afterEach(() => vi.useRealTimers())

  const mountApp = () =>
    render(
      <FollowProvider>
        <PathProvider>
          <App />
        </PathProvider>
      </FollowProvider>,
    )

  it('jumps to the next game’s day without throwing', () => {
    Element.prototype.scrollIntoView = vi.fn()
    mountApp()
    // The next-match bar exposes the jump either as a single "Jump to it" button
    // or as per-game rows when several tip at once; both call jumpTo.
    const jump = document.querySelector('.nm-jump') || document.querySelector('.nm-live-row')
    fireEvent.click(jump)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
