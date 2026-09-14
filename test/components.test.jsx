// Component rendering. The assertions concentrate on what this sport and this
// format changed: FIBA's table columns, the two-group-stage advancement, the
// balanced knockout, overtime instead of penalties, and the placeholder-era board
// where no game has a US broadcast yet.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { GAMES } from './fixtures/pretournament-games.js'
import { computeClinch } from '../src/utils/clinch.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { gamesByNum, groupSlotMap } from '../src/utils/bracket.js'
import Standings from '../src/components/Standings.jsx'
import Bracket from '../src/components/Bracket.jsx'
import MatchCard from '../src/components/MatchCard.jsx'
import MatchDetail from '../src/components/MatchDetail.jsx'
import ScenariosView from '../src/components/ScenariosView.jsx'
import ScoreToasts from '../src/components/ScoreToasts.jsx'
import ChampionBanner from '../src/components/ChampionBanner.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { PathProvider } from '../src/context/path.jsx'
import { DetailContext } from '../src/context/detail.js'
import { withGroupScores, allGroupsPlayed, playStage } from './helpers/tournament.js'

const TZ = 'Asia/Qatar'
const num = (games, n) => games.find((g) => g.num === n)

function wrap(ui, { onDetail = () => {} } = {}) {
  return render(
    <FollowProvider>
      <PathProvider>
        <DetailContext.Provider value={onDetail}>{ui}</DetailContext.Provider>
      </PathProvider>
    </FollowProvider>,
  )
}

// A complete first-round Group A (United States, Greece, Dominican Republic, Nigeria).
const DECISIVE = [
  ['United States', 'Greece', 90, 60],
  ['United States', 'Dominican Republic', 90, 60],
  ['United States', 'Nigeria', 90, 60],
  ['Greece', 'Dominican Republic', 80, 70],
  ['Greece', 'Nigeria', 80, 70],
  ['Dominican Republic', 'Nigeria', 75, 70],
]

describe('Standings', () => {
  it('renders FIBA’s columns, not football’s', () => {
    wrap(<Standings matches={GAMES} tz={TZ} clinch={{}} />)
    const table = screen.getAllByRole('table')[0]
    const heads = within(table).getAllByRole('columnheader').map((th) => th.textContent)
    expect(heads).toEqual(['Team', 'P', 'W', 'L', 'PF', 'PA', 'PD', 'Pts', 'Fin'])
    expect(heads).not.toContain('D')
    expect(heads).not.toContain('GF')
  })

  it('shows all eight first-round groups and the second-round section', () => {
    wrap(<Standings matches={GAMES} tz={TZ} clinch={{}} />)
    for (const g of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      expect(screen.getByRole('button', { name: new RegExp(`Group ${g}`) })).toBeInTheDocument()
    }
    expect(screen.getByText('First round')).toBeInTheDocument()
    expect(screen.getByText('Second round')).toBeInTheDocument()
    expect(screen.getByText(/seeded once the first round finishes/i)).toBeInTheDocument()
  })

  it('says the top two of each group advance', () => {
    wrap(<Standings matches={GAMES} tz={TZ} clinch={{}} />)
    expect(screen.getByText(/Top two of each group advance/)).toBeInTheDocument()
  })

  it('shows FIBA points and a W–L record once games are played', () => {
    const board = withGroupScores('A', DECISIVE, GAMES)
    wrap(<Standings matches={board} tz={TZ} clinch={computeClinch(board)} />)
    const row = screen.getByRole('row', { name: /United States/ })
    const cells = within(row).getAllByRole('cell').map((td) => td.textContent)
    // P, W, L: 3 played, 3 wins, 0 losses; 6 FIBA points.
    expect(cells.slice(1, 4)).toEqual(['3', '3', '0'])
    expect(cells[7]).toBe('6')
  })

  it('projects each group’s top two into their second-round group', () => {
    const board = withGroupScores('A', DECISIVE, GAMES)
    wrap(<Standings matches={board} tz={TZ} clinch={computeClinch(board)} />)
    expect(screen.getAllByText('As it stands → second round').length).toBeGreaterThan(0)
    const list = screen.getAllByText('1st')[0].closest('ul')
    expect(within(list).getByText('2nd')).toBeInTheDocument()
    expect(within(list).getAllByText(/2nd round · Group I/).length).toBeGreaterThan(0)
  })

  it('badges the clinched placings', () => {
    const board = withGroupScores('A', DECISIVE, GAMES)
    wrap(<Standings matches={board} tz={TZ} clinch={computeClinch(board)} />)
    expect(screen.getAllByText(/Won group/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Eliminated/).length).toBeGreaterThan(0)
  })
})

describe('Bracket', () => {
  const board = resolveBracket(GAMES)

  it('labels the columns with the knockout rounds, not a round of 16', () => {
    wrap(<Bracket matches={board} tz={TZ} />)
    expect(screen.getAllByText('Quarter-Final').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Semi-Final').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Round of 16/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Qualification to Quarter/)).not.toBeInTheDocument()
  })

  it('renders every slot by its label while the draw is open', () => {
    wrap(<Bracket matches={board} tz={TZ} />)
    expect(screen.getByText('Winner Group I')).toBeInTheDocument()
    expect(screen.getByText('2nd Group L')).toBeInTheDocument()
    expect(screen.getByText('Loser Game 89')).toBeInTheDocument()
  })

  it('shows the quarter-final crossover', () => {
    wrap(<Bracket matches={board} tz={TZ} />)
    // Game 85 is Winner Group I against 2nd Group L (the I<->L crossover).
    const g85 = document.getElementById('bx-m85')
    expect(within(g85).getByText('Winner Group I')).toBeInTheDocument()
    expect(within(g85).getByText('2nd Group L')).toBeInTheDocument()
  })

  it('opens the detail modal when a game is clicked', () => {
    const onDetail = vi.fn()
    wrap(<Bracket matches={board} tz={TZ} />, { onDetail })
    fireEvent.click(document.getElementById('bx-m85'))
    expect(onDetail).toHaveBeenCalledWith(expect.objectContaining({ num: 85 }))
  })

  it('expands a feed slot to its candidate pair once the source is set', () => {
    // Game 89 = "Winner Game 85" v "Winner Game 87"; resolve game 85.
    const withQf = resolveBracket(
      GAMES.map((g) => (g.num === 85 ? { ...g, t1: 'Australia', t2: 'Italy' } : g)),
    )
    wrap(<Bracket matches={withQf} tz={TZ} />)
    const g89 = document.getElementById('bx-m89')
    expect(within(g89).getByText('Australia')).toBeInTheDocument()
    expect(within(g89).getByText('Italy')).toBeInTheDocument()
  })
})

describe('MatchCard', () => {
  const byNum = gamesByNum(GAMES)
  const slotMap = groupSlotMap(GAMES)

  it('renders a first-round game with its arena and game number', () => {
    wrap(<MatchCard match={num(GAMES, 1)} tz={TZ} byNum={byNum} slotMap={slotMap} />)
    expect(screen.getByText('United States')).toBeInTheDocument()
    expect(screen.getByText('Nigeria')).toBeInTheDocument()
    expect(screen.getByText('Lusail Sports Arena')).toBeInTheDocument()
    expect(screen.getByText('Game 1')).toBeInTheDocument()
  })

  it('shows overtime rather than penalties on a decided game', () => {
    const g = { ...num(GAMES, 1), score: [95, 92], ot: 2 }
    wrap(<MatchCard match={g} tz={TZ} byNum={byNum} slotMap={slotMap} />)
    expect(screen.getByText('2OT')).toBeInTheDocument()
    expect(screen.queryByText(/pens/)).not.toBeInTheDocument()
  })

  it('says "Time TBC" and omits the local clock for a game with no tip-off', () => {
    // No committed game is untimed, so synthesize one to exercise the branch.
    const tbd = { ...num(GAMES, 1), ko: null, tbdTip: true }
    wrap(<MatchCard match={tbd} tz="America/Los_Angeles" byNum={byNum} slotMap={slotMap} />)
    expect(screen.getByText('Time TBC')).toBeInTheDocument()
    expect(document.querySelector('.venue-local')).toBeNull()
  })

  it('shows the venue-local clock on a timed game in a different zone', () => {
    wrap(<MatchCard match={num(GAMES, 1)} tz="America/Los_Angeles" byNum={byNum} slotMap={slotMap} />)
    expect(document.querySelector('.venue-local').textContent).toMatch(/local$/)
  })

  it('says "TV TBC" while no US rights deal is set, and lists streamers in the watch panel', () => {
    wrap(<MatchCard match={num(GAMES, 1)} tz={TZ} byNum={byNum} slotMap={slotMap} />)
    expect(screen.getByText('TV TBC')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /How to watch/ }))
    const notes = document.querySelector('.feed-notes')
    expect(notes.querySelectorAll('li').length).toBeGreaterThan(0)
  })

  it('shows a candidate pair for a resolved feed slot', () => {
    // A semi-final card whose source quarter-final is resolved shows the pair.
    const resolved = resolveBracket(
      GAMES.map((g) => (g.num === 85 ? { ...g, t1: 'Australia', t2: 'Italy' } : g)),
    )
    wrap(<MatchCard match={num(resolved, 89)} tz={TZ} byNum={gamesByNum(resolved)} slotMap={slotMap} />)
    expect(screen.getByText('Australia')).toBeInTheDocument()
    expect(screen.getByText('Italy')).toBeInTheDocument()
  })

  it('badges a clinched first-round team', () => {
    const board = withGroupScores('A', DECISIVE, GAMES)
    wrap(
      <MatchCard match={num(board, 1)} tz={TZ} byNum={gamesByNum(board)} slotMap={slotMap} clinch={computeClinch(board)} />,
    )
    expect(screen.getAllByText(/Won group|Advanced/).length).toBeGreaterThan(0)
  })
})

describe('MatchDetail', () => {
  it('shows a W–L tale of the tape with no draw or clean-sheet row', () => {
    // Play the first two stages so a quarter-final has real teams with records.
    let board = playStage('R1')
    board = resolveBracket(board)
    board = playStage('R2', board)
    board = resolveBracket(board)
    wrap(<MatchDetail match={num(board, 85)} tz={TZ} allMatches={board} onClose={() => {}} />)
    expect(screen.getByText('W–L')).toBeInTheDocument()
    expect(screen.getByText('Points per game')).toBeInTheDocument()
    expect(screen.queryByText('W–D–L')).not.toBeInTheDocument()
    expect(screen.queryByText('Clean sheets')).not.toBeInTheDocument()
  })

  it('shows the arena and the US broadcast, with no Spanish row', () => {
    wrap(<MatchDetail match={num(GAMES, 1)} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getByText(/Lusail Sports Arena/)).toBeInTheDocument()
    expect(screen.getByText('How to watch (US)')).toBeInTheDocument()
    expect(screen.queryByText('Spanish')).not.toBeInTheDocument()
  })

  it('notes overtime on a finished game', () => {
    const g = { ...num(GAMES, 1), score: [95, 92], ot: 1 }
    wrap(<MatchDetail match={g} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getByText('after overtime')).toBeInTheDocument()
  })

  it('gives an untimed game its date and no invented tip-off time', () => {
    // Synthesize an untimed game to exercise the no-ko branch.
    const g = { ...num(GAMES, 91), ko: null, date: '2027-09-12' }
    wrap(<MatchDetail match={g} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getByText('Time TBC')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/1969|1970/)
  })

  it('shows the edition-wide US streaming line', () => {
    wrap(<MatchDetail match={num(GAMES, 1)} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getAllByText(/DAZN, HBO Max/).length).toBeGreaterThan(0)
  })

  it('names an unresolved knockout game by its slot labels', () => {
    wrap(<MatchDetail match={num(GAMES, 89)} tz={TZ} allMatches={GAMES} onClose={() => {}} />)
    expect(screen.getByText('Winner Game 85')).toBeInTheDocument()
    expect(screen.getByText('Winner Game 87')).toBeInTheDocument()
  })
})

describe('ScenariosView', () => {
  it('offers two outcomes per game and no draw button', () => {
    wrap(<ScenariosView matches={GAMES} />)
    const first = document.querySelector('.sc-fixture')
    const buttons = within(first).getAllByRole('button')
    expect(buttons).toHaveLength(2)
    expect(buttons.map((b) => b.textContent)).toEqual(['W', 'W'])
    expect(within(first).queryByText('D')).not.toBeInTheDocument()
  })

  it('recomputes the table and the projection from a pick', () => {
    wrap(<ScenariosView matches={GAMES} />)
    const first = document.querySelector('.sc-fixture')
    fireEvent.click(within(first).getAllByRole('button')[0])
    expect(screen.getAllByText(/possible orders/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Projected second round').length).toBe(8)
  })

  it('retires itself once every first-round game is final', () => {
    wrap(<ScenariosView matches={allGroupsPlayed()} />)
    expect(screen.getByText(/Every group is decided/)).toBeInTheDocument()
  })
})

describe('broadcast branches (synthetic tv, since 2027 has no rights yet)', () => {
  const byNum = gamesByNum(GAMES)
  const slotMap = groupSlotMap(GAMES)

  it('badges a network the viewer does not have, and a round-level note', () => {
    wrap(
      <MatchCard
        match={{ ...num(GAMES, 1), tv: ['TNT'], tvNote: 'Also on truTV' }}
        tz={TZ}
        byNum={byNum}
        slotMap={slotMap}
      />,
    )
    expect(screen.getByText('TNT')).toBeInTheDocument()
    expect(screen.getByText('Also on truTV')).toBeInTheDocument()
  })

  it('renders the box-score section and a per-outlet note for a played game', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    wrap(
      <MatchDetail
        match={{ ...num(GAMES, 1), score: [88, 61], tv: ['HBO Max'] }}
        tz={TZ}
        allMatches={GAMES}
        onClose={() => {}}
      />,
    )
    expect(await screen.findByText(/Box score/)).toBeInTheDocument()
    expect(screen.getByText(/Standard or Premium/)).toBeInTheDocument()
  })
})

describe('ScoreToasts', () => {
  it('renders a final-score toast and dismisses it', () => {
    const onDismiss = vi.fn()
    const onOpen = vi.fn()
    const game = { num: 1, t1: 'United States', t2: 'Nigeria', score: [88, 61] }
    render(
      <ScoreToasts items={[{ id: 'final|1', ev: { game } }]} onOpen={onOpen} onDismiss={onDismiss} />,
    )
    expect(screen.getByText(/FINAL: United States win/)).toBeInTheDocument()
    expect(screen.getByText('United States 88–61 Nigeria')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Open game details'))
    expect(onOpen).toHaveBeenCalledWith(game)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('renders nothing when there is nothing to show', () => {
    const { container } = render(<ScoreToasts items={[]} onOpen={() => {}} onDismiss={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ChampionBanner', () => {
  const decidedFinal = { ...num(GAMES, 92), t1: 'Australia', t2: 'Japan', score: [90, 80] }

  it('stays hidden until the Final is decided', () => {
    const { container } = wrap(<ChampionBanner match={num(GAMES, 92)} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('crowns the winner of the Final', () => {
    wrap(<ChampionBanner match={decidedFinal} />)
    expect(screen.getByText('Australia')).toBeInTheDocument()
    expect(screen.getByText(/champions/)).toBeInTheDocument()
  })

  it('does not crown a team that is merely winning', () => {
    const { container } = wrap(<ChampionBanner match={{ ...decidedFinal, live: { clock: '2:00' } }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden in spoiler-free mode', () => {
    const { container } = wrap(<ChampionBanner match={decidedFinal} hideScores />)
    expect(container).toBeEmptyDOMElement()
  })
})
