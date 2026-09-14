// The second group stage: seeding from the first round and the head-to-head
// CARRYOVER, the one computation the family did not already have.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  R2_MEMBERSHIP,
  SECOND_ROUND_GROUPS,
} from '../src/utils/qualification.js'
import {
  advancersFrom,
  r2Members,
  rankSecondRound,
  secondRoundComplete,
  computeSecondRound,
} from '../src/utils/secondRound.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { playStage } from './helpers/tournament.js'

// Higher-ranked side wins, so first round finishes:
//   A: US, Greece   B: Serbia, Lithuania   ...  H: Spain, Türkiye
const afterR1 = playStage('R1', GAMES)
// Resolve the second-round slots to real teams, then play them.
const afterR2 = playStage('R2', resolveBracket(afterR1))

describe('the merge wiring', () => {
  it('merges adjacent first-round pairs into I-L', () => {
    expect(R2_MEMBERSHIP).toEqual({ I: ['A', 'B'], J: ['C', 'D'], K: ['E', 'F'], L: ['G', 'H'] })
    expect(SECOND_ROUND_GROUPS).toEqual(['I', 'J', 'K', 'L'])
  })
})

describe('advancersFrom', () => {
  it('returns null while the group is unfinished', () => {
    expect(advancersFrom('A', GAMES)).toBeNull()
  })

  it('names the top two of a finished group in finishing order', () => {
    expect(advancersFrom('A', afterR1)).toEqual(['United States', 'Greece'])
    expect(advancersFrom('B', afterR1)).toEqual(['Serbia', 'Lithuania'])
  })
})

describe('r2Members', () => {
  it('is null until BOTH feeding groups are decided', () => {
    // Only group A played: group I still cannot be seeded (needs B too).
    const onlyA = GAMES.map((g) =>
      g.stage === 'R1' && g.group === 'A' ? { ...g, score: [90, 70] } : g,
    )
    expect(r2Members('I', onlyA)).toBeNull()
  })

  it('lists the four qualifiers, group1 pair then group2 pair', () => {
    expect(r2Members('I', afterR1).map((t) => t.name)).toEqual([
      'United States', 'Greece', 'Serbia', 'Lithuania',
    ])
  })
})

describe('the carryover', () => {
  it('counts the intra-pair first-round game before any new game is played', () => {
    // After the first round only, each team in group I has played exactly one
    // second-round-table game: the carried-over game against its group-mate.
    const rows = rankSecondRound('I', afterR1)
    for (const r of rows) expect(r.P).toBe(1)
    // The US beat Greece in group A; that result carries into group I.
    const us = rows.find((r) => r.name === 'United States')
    const greece = rows.find((r) => r.name === 'Greece')
    expect(us.W).toBe(1)
    expect(greece.L).toBe(1)
  })

  it('ranks the finished second-round group over all three games each', () => {
    const rows = rankSecondRound('I', afterR2)
    for (const r of rows) expect(r.P).toBe(3) // one carryover + two new
    expect(rows.map((r) => r.name)).toEqual([
      'United States', 'Serbia', 'Greece', 'Lithuania',
    ])
    expect(rows[0].Pts).toBe(6) // US 3-0 across the second-round table
  })

  it('is null before the group is seeded', () => {
    expect(rankSecondRound('I', GAMES)).toBeNull()
  })
})

describe('secondRoundComplete', () => {
  it('is false before seeding, false part-way, true once all six count', () => {
    expect(secondRoundComplete('I', GAMES)).toBe(false)
    expect(secondRoundComplete('I', afterR1)).toBe(false) // only the two carryovers
    expect(secondRoundComplete('I', afterR2)).toBe(true)
  })
})

describe('computeSecondRound', () => {
  it('reports nothing seeded before the first round finishes', () => {
    const sr = computeSecondRound(GAMES)
    expect(sr.allSeeded).toBe(false)
    expect(sr.allComplete).toBe(false)
    for (const k of SECOND_ROUND_GROUPS) {
      expect(sr.groups[k]).toBeNull()
      expect(sr.members[k]).toBeNull()
      expect(sr.completion[k]).toBe(false)
    }
  })

  it('seeds every group once the first round is done', () => {
    const sr = computeSecondRound(afterR1)
    expect(sr.allSeeded).toBe(true)
    expect(sr.allComplete).toBe(false)
    for (const k of SECOND_ROUND_GROUPS) expect(sr.groups[k]).toHaveLength(4)
  })

  it('reports all groups complete once the second round is played', () => {
    const sr = computeSecondRound(afterR2)
    expect(sr.allComplete).toBe(true)
    for (const k of SECOND_ROUND_GROUPS) expect(sr.completion[k]).toBe(true)
  })
})
