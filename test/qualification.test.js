// FIBA group ranking (men's two-stage format).
//
// The tests that matter are the DISCRIMINATING ones: cases where FIBA's rules
// give a different answer from the football rules this repo was grown from. A test
// that only checks "more wins finishes higher" would pass against either rule set.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import { TEAMS } from '../src/data/teams.js'
import {
  ADVANCING_PER_GROUP,
  FIRST_ROUND_GROUPS,
  SECOND_ROUND_GROUPS,
  GROUP_GAME_COUNT,
  LOSS_POINTS,
  WIN_POINTS,
  byLots,
  computeQualification,
  gamesAmong,
  groupComplete,
  headToHead,
  isGroupStage,
  rankGroup,
  rowStatus,
  rowStatusR2,
} from '../src/utils/qualification.js'
import { withGroupScores } from './helpers/tournament.js'

// Group A is United States, Greece, Dominican Republic, Nigeria (world-ranking order).
const A = (results) => withGroupScores('A', results, GAMES)
const order = (rows) => rows.map((r) => r.name)
const rank = (members, games) => rankGroup(members, games)

// A first-round group A completed with US 3-0, Greece 2-1, Dominican Republic 1-2,
// Nigeria 0-3.
const DECISIVE = [
  ['United States', 'Nigeria', 90, 60],
  ['United States', 'Dominican Republic', 90, 60],
  ['United States', 'Greece', 90, 60],
  ['Greece', 'Dominican Republic', 90, 60],
  ['Greece', 'Nigeria', 90, 60],
  ['Dominican Republic', 'Nigeria', 90, 60],
]

describe('FIBA points', () => {
  it('awards 2 for a win and 1 for a LOSS', () => {
    expect(WIN_POINTS).toBe(2)
    expect(LOSS_POINTS).toBe(1)
  })

  it('gives a 3-0 team 6 points and an 0-3 team 3, not 9 and 0', () => {
    const rows = rank(TEAMS.A, A(DECISIVE))
    const us = rows.find((r) => r.name === 'United States')
    const nigeria = rows.find((r) => r.name === 'Nigeria')
    expect(us.W).toBe(3)
    expect(us.Pts).toBe(6)
    expect(nigeria.L).toBe(3)
    expect(nigeria.Pts).toBe(3) // a football table would say 0
  })

  it('counts points for and against, not goals', () => {
    const rows = rank(TEAMS.A, A([['United States', 'Nigeria', 88, 61]]))
    const us = rows.find((r) => r.name === 'United States')
    expect(us.PF).toBe(88)
    expect(us.PA).toBe(61)
    expect(us.PD).toBe(27)
  })

  it('never records a draw column', () => {
    for (const r of rank(TEAMS.A, GAMES)) expect(r).not.toHaveProperty('D')
  })

  it('ignores a level score rather than treating it as a draw', () => {
    const rows = rank(TEAMS.A, A([['United States', 'Nigeria', 70, 70]]))
    for (const r of rows) expect(r.P).toBe(0)
  })

  it('gamesAmong keeps only decided group-stage games between the named teams', () => {
    const board = A([
      ['United States', 'Nigeria', 80, 70],
      ['Greece', 'Dominican Republic', 71, 70],
    ])
    const among = gamesAmong(['United States', 'Nigeria'], board)
    expect(among).toHaveLength(1)
    expect(among[0].t1).toBe('United States')
    // a level score is skipped as a data error
    expect(gamesAmong(['Greece', 'Dominican Republic'],
      A([['Greece', 'Dominican Republic', 70, 70]]))).toHaveLength(0)
  })

  it('isGroupStage recognises both group stages and nothing else', () => {
    expect(isGroupStage({ stage: 'R1' })).toBe(true)
    expect(isGroupStage({ stage: 'R2' })).toBe(true)
    expect(isGroupStage({ stage: 'QF' })).toBe(false)
    expect(isGroupStage({ stage: 'Class' })).toBe(false)
  })
})

describe('tie-breakers', () => {
  // United States and Greece both finish 2-1. Greece won the game between them, so
  // head-to-head puts Greece first, but the US ran up a far bigger overall point
  // difference (a blowout of Nigeria). FIBA ranks head-to-head FIRST, so Greece
  // must win the tie even though the US has the better overall PD.
  const conflicting = A([
    ['United States', 'Greece', 70, 72], // Greece win the head-to-head
    ['United States', 'Dominican Republic', 80, 70],
    ['United States', 'Nigeria', 120, 60], // ...but the US inflate their overall PD
    ['Greece', 'Dominican Republic', 75, 70],
    ['Nigeria', 'Greece', 80, 70], // Greece drop a game, still 2-1
    ['Dominican Republic', 'Nigeria', 75, 70],
  ])

  it('puts head-to-head AHEAD of overall point difference', () => {
    const tied = rank(TEAMS.A, conflicting).filter((r) => r.Pts === 5)
    expect(tied.map((r) => r.name)).toEqual(['Greece', 'United States'])
  })

  it('is genuinely a conflict: overall PD alone would order it differently', () => {
    const tied = rank(TEAMS.A, conflicting).filter((r) => r.Pts === 5)
    const byPD = [...tied].sort((a, b) => b.PD - a.PD).map((r) => r.name)
    expect(byPD).toEqual(['United States', 'Greece'])
    expect(byPD).not.toEqual(order(tied))
  })

  it('breaks a straight two-way tie on the game between them', () => {
    const board = A([
      ['United States', 'Nigeria', 90, 60],
      ['Greece', 'Dominican Republic', 90, 60],
      ['United States', 'Greece', 70, 75], // Greece beat US
      ['Dominican Republic', 'United States', 60, 80],
      ['Nigeria', 'Greece', 60, 80],
      ['Dominican Republic', 'Nigeria', 90, 60],
    ])
    const names = order(rank(TEAMS.A, board))
    expect(names.indexOf('Greece')).toBeLessThan(names.indexOf('United States'))
  })

  it('builds a head-to-head table from only the games between the named teams', () => {
    const board = A([
      ['United States', 'Greece', 80, 70],
      ['United States', 'Nigeria', 120, 50], // must NOT affect the US/Greece sub-table
    ])
    const sub = headToHead(['United States', 'Greece'], board)
    expect(sub['United States'].PD).toBe(10)
    expect(sub['United States'].PF).toBe(80)
    expect(sub.Greece.PD).toBe(-10)
  })

  it('leaves an empty head-to-head table when the teams have not met', () => {
    const sub = headToHead(['United States', 'Greece'], GAMES)
    expect(sub['United States']).toEqual({ Pts: 0, PD: 0, PF: 0 })
  })

  // FIBA draws lots as a last resort; the app stands in the FIBA World Ranking.
  // These assert it is the RANKING, not the alphabet.
  it('settles an unbreakable tie by world ranking, not alphabetically', () => {
    expect(byLots('United States', 'Greece')).toBeLessThan(0) // 1 before 9
    expect(byLots('Nigeria', 'Greece')).toBeGreaterThan(0) // 25 after 9
    expect(byLots('Serbia', 'Germany')).toBeLessThan(0) // 2 before 3
    expect(byLots('Qatar', 'Spain')).toBeGreaterThan(0) // 32 after 8
  })

  it('opens the unplayed tournament in world-ranking order', () => {
    expect(order(rank(TEAMS.A, GAMES))).toEqual([
      'United States', 'Greece', 'Dominican Republic', 'Nigeria',
    ])
    expect(order(rank(TEAMS.H, GAMES))).toEqual(['Spain', 'Türkiye', 'Venezuela', 'Qatar'])
  })

  it('still lets results beat the ranking', () => {
    // Nigeria (25th) sweeps its group, so it must top it despite the ranking.
    const board = A([
      ['Nigeria', 'United States', 80, 70],
      ['Nigeria', 'Greece', 85, 70],
      ['Nigeria', 'Dominican Republic', 90, 70],
      ['United States', 'Greece', 75, 70],
      ['United States', 'Dominican Republic', 75, 70],
      ['Greece', 'Dominican Republic', 75, 70],
    ])
    expect(order(rank(TEAMS.A, board))[0]).toBe('Nigeria')
  })
})

describe('advancement', () => {
  it('advances the top two of each group', () => {
    expect(ADVANCING_PER_GROUP).toBe(2)
    expect(FIRST_ROUND_GROUPS).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(SECOND_ROUND_GROUPS).toEqual(['I', 'J', 'K', 'L'])
    expect(GROUP_GAME_COUNT).toBe(6)
  })

  const complete = A(DECISIVE)

  it('labels the four first-round placings r2 / r2 / out / out', () => {
    const qual = computeQualification(complete)
    expect(qual.groups.A.map((r) => rowStatus(r, qual.completion.A))).toEqual([
      'r2', 'r2', 'out', 'out',
    ])
  })

  it('labels the four second-round placings ko / ko / out / out', () => {
    const rows = rank(TEAMS.A, complete)
    expect(rows.map((r) => rowStatusR2(r, true))).toEqual(['ko', 'ko', 'out', 'out'])
  })

  it('says nothing about placing while a group is still in progress', () => {
    const qual = computeQualification(A([['United States', 'Nigeria', 90, 60]]))
    for (const r of qual.groups.A) expect(rowStatus(r, qual.completion.A)).toBeNull()
    expect(rowStatusR2(qual.groups.A[0], false)).toBeNull()
  })

  it('reports completion per group and overall', () => {
    expect(groupComplete(TEAMS.A, complete)).toBe(true)
    expect(groupComplete(TEAMS.B, complete)).toBe(false)
    expect(computeQualification(complete).allComplete).toBe(false)
    expect(computeQualification(GAMES).allComplete).toBe(false)
  })

  it('does not count a live or voided game toward group completion', () => {
    const idx = complete.findIndex((g) => g.stage === 'R1' && g.group === 'A' && g.score)
    const flag = (key) => complete.map((g, i) => (i === idx ? { ...g, [key]: true } : g))
    expect(groupComplete(TEAMS.A, flag('live'))).toBe(false)
    expect(groupComplete(TEAMS.A, flag('voided'))).toBe(false)
    expect(groupComplete(TEAMS.A, complete)).toBe(true)
  })

  it('ranks all four teams even before a ball is thrown up', () => {
    const rows = rank(TEAMS.A, GAMES)
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4])
    for (const r of rows) expect(r.P).toBe(0)
  })

  it('computeQualification ranks and reports every first-round group', () => {
    const qual = computeQualification(GAMES)
    expect(Object.keys(qual.groups)).toEqual(FIRST_ROUND_GROUPS)
    for (const g of FIRST_ROUND_GROUPS) {
      expect(qual.groups[g]).toHaveLength(4)
      expect(qual.completion[g]).toBe(false)
    }
  })
})
