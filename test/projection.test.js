// "As it stands" projection across the two hops: a first-round group's top two
// into a second-round group, and a second-round group's top two into a
// quarter-final with a named (or pending) opponent.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import { projectKnockout } from '../src/utils/asItStands.js'
import {
  PICK_SCORES,
  applyScenarioPicks,
  groupStageArchived,
  openGroups,
  pickOutcome,
  possibleOrderings,
  remainingGroupGames,
  stageArchived,
  unpickedCount,
} from '../src/utils/scenarios.js'
import { playStage, withGroupScores } from './helpers/tournament.js'

const A = (results) => withGroupScores('A', results, GAMES)
const DECISIVE_A = [
  ['United States', 'Nigeria', 90, 60],
  ['United States', 'Dominican Republic', 90, 60],
  ['United States', 'Greece', 90, 60],
  ['Greece', 'Dominican Republic', 90, 60],
  ['Greece', 'Nigeria', 90, 60],
  ['Dominican Republic', 'Nigeria', 90, 60],
]

// Score only the two groups that feed second-round group I (A and B).
const abDone = GAMES.map((g) =>
  g.stage === 'R1' && (g.group === 'A' || g.group === 'B') ? { ...g, score: [90, 70] } : g,
)
const afterR1 = playStage('R1', GAMES)

describe('the first-round hop', () => {
  it('names each group’s current top two and the second-round group they feed', () => {
    const { r1 } = projectKnockout(GAMES)
    expect(r1.A.first).toEqual({ team: 'United States', r2group: 'I' })
    expect(r1.A.second).toEqual({ team: 'Greece', r2group: 'I' })
    expect(r1.H.first).toEqual({ team: 'Spain', r2group: 'L' })
    expect(r1.G.first.r2group).toBe('L')
  })
})

describe('the second-round hop', () => {
  it('is null until the group is seeded', () => {
    expect(projectKnockout(GAMES).r2.I).toBeNull()
  })

  it('names a pending opponent slot while the paired group is unseeded', () => {
    // Groups A & B are done (group I is seeded) but G & H are not (group L is not),
    // so I's winner has a quarter-final game but no named opponent yet.
    const { r2 } = projectKnockout(abDone)
    expect(r2.I.first.gameNum).toBe(85)
    expect(r2.I.first.round).toBe('QF')
    expect(r2.I.first.team).toBeTruthy()
    expect(r2.I.first.opponent).toBeNull()
    expect(r2.I.first.opponentLabel).toBe('2nd Group L')
    expect(r2.L).toBeNull()
  })

  it('names a real opponent once every group is seeded', () => {
    const { r2 } = projectKnockout(afterR1)
    // Game 85 is Winner Group I v 2nd Group L: I's winner meets L's runner-up.
    expect(r2.I.first.opponent).toBeTruthy()
    expect(r2.I.first.opponentLabel).toBeNull()
    // I's runner-up plays game 86 (v Winner Group L).
    expect(r2.I.second.gameNum).toBe(86)
    expect(r2.I.second.opponent).toBeTruthy()
  })
})

describe('the scenarios what-if helpers (first round)', () => {
  it('offers a win for each side and NO draw', () => {
    expect(Object.keys(PICK_SCORES).sort()).toEqual(['away', 'home'])
    expect(PICK_SCORES.home[0]).toBeGreaterThan(PICK_SCORES.home[1])
    expect(PICK_SCORES.away[1]).toBeGreaterThan(PICK_SCORES.away[0])
  })

  it('categorises a pick, and refuses a level score', () => {
    expect(pickOutcome([80, 70])).toBe('home')
    expect(pickOutcome([70, 80])).toBe('away')
    expect(pickOutcome([70, 70])).toBeNull()
    expect(pickOutcome(null)).toBeNull()
  })

  it('lists the remaining first-round games by group', () => {
    const open = remainingGroupGames(GAMES)
    expect(Object.keys(open).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(open.A).toHaveLength(6)
    expect(openGroups(GAMES)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(unpickedCount(GAMES, {})).toBe(48)
  })

  it('applies picks and counts what is left', () => {
    const picks = { 1: [80, 70], 2: [70, 80] }
    const board = applyScenarioPicks(GAMES, picks)
    expect(board.find((g) => g.num === 1).score).toEqual([80, 70])
    expect(unpickedCount(GAMES, picks)).toBe(46)
    expect(applyScenarioPicks(GAMES, {})).toBe(GAMES)
  })

  it('counts the orderings a group still has open', () => {
    expect(possibleOrderings('A', GAMES)).toEqual({ count: 24, decided: false })
    expect(possibleOrderings('A', A(DECISIVE_A))).toEqual({ count: 1, decided: true })
  })

  it('archives the first round only once every game is final', () => {
    expect(stageArchived(GAMES, 'R1')).toBe(false)
    expect(groupStageArchived(GAMES)).toBe(false)
    const played = playStage('R1', GAMES)
    expect(groupStageArchived(played)).toBe(true)
    const live = played.map((g) => (g.num === 1 ? { ...g, live: {} } : g))
    expect(groupStageArchived(live)).toBe(false)
  })
})
