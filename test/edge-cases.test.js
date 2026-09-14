// Defensive and edge-case branches across the pure engine modules.
//
// These are the arms a normal tournament never reaches: malformed records, a total
// tie nothing can separate, the tie-break restart rule, a half-resolved bracket.
// They exist so a bad feed degrades rather than crashes.
//
// NOTE: the cross-cutting edge tests the women's edition kept here (ics, time,
// groupColors, urlState, tournamentStats, search on an empty record) live with
// their own modules' suites now; this file is the engine edges.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import { TEAMS } from '../src/data/teams.js'
import { projectKnockout } from '../src/utils/asItStands.js'
import { gamesByNum, pathToFinal } from '../src/utils/bracket.js'
import {
  resolveKnockoutSlots,
  resolvePlacingSlots,
} from '../src/utils/bracketResolve.js'
import { computeClinch, groupPositionBounds, reachableOrderings } from '../src/utils/clinch.js'
import { headToHead, rankGroup } from '../src/utils/qualification.js'
import { softTiebreaks } from '../src/utils/tiebreakNotes.js'
import { withGroupScores, playStage } from './helpers/tournament.js'

const A = (results) => withGroupScores('A', results, GAMES)

describe('malformed game records', () => {
  it('skips a group game naming a team outside the group', () => {
    const bogus = GAMES.map((g) =>
      g.stage === 'R1' && g.group === 'A' && g.t1 === 'Italy'
        ? { ...g, t1: 'Narnia', score: [80, 70] }
        : g,
    )
    const rows = rankGroup(TEAMS.A, bogus)
    expect(rows).toHaveLength(4)
    for (const r of rows) expect(r.P).toBe(0)
    expect(rows.some((r) => r.name === 'Narnia')).toBe(false)
  })

  it('skips a level score in the head-to-head sub-table', () => {
    const drawn = A([['Italy', 'Dominican Republic', 70, 70]])
    expect(headToHead(['Italy', 'Dominican Republic'], drawn)).toEqual({
      'Italy': { Pts: 0, PD: 0, PF: 0 },
      'Dominican Republic': { Pts: 0, PD: 0, PF: 0 },
    })
  })

  it('records the head-to-head win whichever way round the record lists it', () => {
    const italyWon = A([['Italy', 'Dominican Republic', 90, 60]])
    const drWon = A([['Italy', 'Dominican Republic', 60, 90]])
    expect(headToHead(['Italy', 'Dominican Republic'], italyWon)['Italy'].Pts).toBe(2)
    expect(headToHead(['Italy', 'Dominican Republic'], drWon)['Dominican Republic'].Pts).toBe(2)
    expect(headToHead(['Italy', 'Dominican Republic'], drWon)['Italy'].Pts).toBe(1)
  })

  it('ignores a level score when counting group points', () => {
    const drawn = A([['Italy', 'Angola', 70, 70]])
    expect(computeClinch(drawn)['Italy']).toBeNull()
    expect(groupPositionBounds(drawn)['Italy']).toEqual({ best: 1, worst: 4 })
  })
})

describe('a total tie nothing can separate', () => {
  // Italy, Dominican Republic and Philippines form a 2-1 cycle with the SAME margin
  // in all three games, and each beats Angola by the same margin, so they are level
  // on every computable criterion. Only a drawing of lots is left.
  const mirrored = A([
    ['Italy', 'Dominican Republic', 80, 70],
    ['Dominican Republic', 'Philippines', 80, 70],
    ['Philippines', 'Italy', 80, 70],
    ['Italy', 'Angola', 90, 60],
    ['Angola', 'Dominican Republic', 60, 90],
    ['Philippines', 'Angola', 90, 60],
  ])

  it('really is level on every computable criterion', () => {
    const tied = rankGroup(TEAMS.A, mirrored).filter((r) => r.name !== 'Angola')
    expect(tied).toHaveLength(3)
    for (const r of tied) {
      expect(r.Pts).toBe(5)
      expect(r.PD).toBe(30)
      expect(r.PF).toBe(240)
    }
    const sub = headToHead(tied.map((r) => r.name), mirrored)
    for (const v of Object.values(sub)) expect(v).toEqual({ Pts: 3, PD: 0, PF: 150 })
  })

  it('cannot produce a four-way tie on points, by arithmetic', () => {
    for (const board of [mirrored, A([['Italy', 'Angola', 80, 70]]), GAMES]) {
      const rows = rankGroup(TEAMS.A, board)
      const allSame = rows.every((r) => r.Pts === rows[0].Pts)
      const anyPlayed = rows.some((r) => r.P > 0)
      expect(allSame && anyPlayed).toBe(false)
    }
  })

  it('still returns four ordered rows, deterministically', () => {
    const once = rankGroup(TEAMS.A, mirrored).map((r) => r.name)
    const twice = rankGroup(TEAMS.A, mirrored).map((r) => r.name)
    expect(once).toEqual(twice)
    expect(rankGroup(TEAMS.A, mirrored).map((r) => r.rank)).toEqual([1, 2, 3, 4])
  })

  it('marks the placings as decided by lots', () => {
    const notes = softTiebreaks(TEAMS.A, mirrored)
    expect(notes.size).toBeGreaterThan(0)
    for (const n of notes.values()) expect(n.reason).toBe('lots')
  })
})

describe('the restart rule', () => {
  // A three-way tie that head-to-head splits into ONE clear leader and TWO teams
  // still level, the only shape that reaches the recursive re-rank. Italy, Dominican
  // Republic and Philippines finish 2-1; in the head-to-head mini-league Italy is
  // clear on point difference while Dominican Republic and Philippines remain level,
  // and the restart pass ranks them on the game between just those two.
  const board = A([
    ['Italy', 'Dominican Republic', 100, 70], // Italy +30 in the cycle
    ['Dominican Republic', 'Philippines', 85, 65], // Dominican Republic +20
    ['Philippines', 'Italy', 90, 80], // Philippines +10  (2*20 = 30 + 10)
    ['Italy', 'Angola', 95, 60],
    ['Angola', 'Dominican Republic', 60, 95],
    ['Philippines', 'Angola', 95, 60],
  ])

  it('leaves exactly two of the three level while the leader is clear', () => {
    const tied = rankGroup(TEAMS.A, board).filter((r) => r.Pts === 5)
    expect(tied).toHaveLength(3)
    const sub = headToHead(tied.map((r) => r.name), board)
    expect(sub['Dominican Republic']).toEqual(sub.Philippines)
    expect(sub['Italy'].PD).toBeGreaterThan(sub['Dominican Republic'].PD)
  })

  it('separates the leader, then re-ranks the two still level', () => {
    const order = rankGroup(TEAMS.A, board)
      .filter((r) => r.Pts === 5)
      .map((r) => r.name)
    expect(order).toEqual(['Italy', 'Dominican Republic', 'Philippines'])
  })
})

describe('bracket edges', () => {
  const put = (num, patch) => gamesByNum(GAMES.map((g) => (g.num === num ? { ...g, ...patch } : g)))

  it('names the winner when the second side wins (koWinner b > a)', () => {
    const p = pathToFinal('United States', put(85, { t1: 'United States', t2: 'Serbia', score: [70, 80] }))
    expect(p.exitNum).toBe(85)
  })

  it('treats a level knockout score as undecided, not a win', () => {
    const board = GAMES.map((g) =>
      g.num === 85 ? { ...g, t1: 'United States', t2: 'Serbia', score: [80, 80] } : g,
    )
    const p = pathToFinal('United States', gamesByNum(board))
    expect(p.exitNum).toBeNull()
    expect(resolveKnockoutSlots(board).find((g) => g.num === 89).t1).toBeNull()
  })

  it('leaves a slot alone when its label is missing entirely', () => {
    const board = GAMES.map((g) => (g.num === 89 ? { ...g, label2: null } : g))
    expect(resolveKnockoutSlots(board).find((g) => g.num === 89).t2).toBeNull()
  })
})

describe('placing-slot edges', () => {
  const afterR1 = playStage('R1', GAMES)

  it('leaves a second-round slot alone when its label is null, resolving the other side', () => {
    const board = afterR1.map((g) => (g.num === 49 ? { ...g, label1: null } : g))
    const out = resolvePlacingSlots(board, ['R2'])
    const g49 = out.find((g) => g.num === 49)
    expect(g49.t1).toBeNull() // null label cannot resolve
    expect(g49.t2).toBeTruthy() // the well-formed side still resolves
  })

  it('enumerates the orderings of a group with one game left', () => {
    const oneLeft = A([
      ['Italy', 'Angola', 90, 60],
      ['Dominican Republic', 'Philippines', 90, 60],
      ['Italy', 'Philippines', 90, 60],
      ['Angola', 'Dominican Republic', 60, 90],
      ['Philippines', 'Angola', 80, 70],
    ])
    const orders = reachableOrderings('A', oneLeft)
    expect(orders.size).toBeGreaterThan(1)
    for (const o of orders) expect(o.split('>')).toHaveLength(4)
  })
})

describe('projection edges', () => {
  it('reads invariant labels even when the live board already names teams', () => {
    const board = resolvePlacingSlots(playStage('R1', GAMES), ['R2'])
    // group I's second-round games now name teams; the projection still keys off
    // the committed quarter-final labels.
    const { r1, r2 } = projectKnockout(board)
    expect(r1.A.first.team).toBeTruthy()
    expect(r2.I.first.round).toBe('QF')
  })

  it('reports no opponent label for a named side', () => {
    const { r2 } = projectKnockout(playStage('R1', GAMES))
    expect(r2.I.first.opponentLabel).toBeNull()
    expect(r2.I.first.opponent).toBeTruthy()
  })
})
