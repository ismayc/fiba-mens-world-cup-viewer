// Clinch / elimination detection across both group stages.
//
// The engine's contract is that it NEVER over-claims: a verdict holds under every
// remaining win/loss outcome. Most of these tests are about what it refuses to say.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  clinchBadge,
  clinchHeadline,
  computeClinch,
  computeClinchR2,
  groupPositionBounds,
  groupPositionBoundsR2,
  newlyClinched,
  reachableOrderings,
} from '../src/utils/clinch.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { withGroupScores, playStage } from './helpers/tournament.js'

const A = (results) => withGroupScores('A', results, GAMES)

// Group A completed: US 3-0, Greece 2-1, Dominican Republic 1-2, Nigeria 0-3.
const DECISIVE = [
  ['United States', 'Nigeria', 90, 60],
  ['United States', 'Dominican Republic', 90, 60],
  ['United States', 'Greece', 90, 60],
  ['Greece', 'Dominican Republic', 90, 60],
  ['Greece', 'Nigeria', 90, 60],
  ['Dominican Republic', 'Nigeria', 90, 60],
]

describe('a completed first-round group', () => {
  const done = A(DECISIVE)
  const clinch = computeClinch(done)

  it('marks the winner, the other qualifier, and the eliminated pair', () => {
    expect(clinch['United States']).toBe('won-group')
    expect(clinch.Greece).toBe('advanced')
    expect(clinch['Dominican Republic']).toBe('eliminated')
    expect(clinch.Nigeria).toBe('eliminated')
  })

  it('locks every position', () => {
    const b = groupPositionBounds(done)
    expect(b['United States']).toEqual({ best: 1, worst: 1 })
    expect(b.Greece).toEqual({ best: 2, worst: 2 })
    expect(b['Dominican Republic']).toEqual({ best: 3, worst: 3 })
    expect(b.Nigeria).toEqual({ best: 4, worst: 4 })
  })

  it('leaves the other groups undecided', () => {
    expect(clinch.Serbia).toBeNull()
  })

  it('reports exactly one reachable ordering', () => {
    expect(reachableOrderings('A', done).size).toBe(1)
  })
})

describe('before anything is played', () => {
  const clinch = computeClinch(GAMES)

  it('claims nothing at all', () => {
    for (const v of Object.values(clinch)) expect(v).toBeNull()
  })

  it('leaves every team able to finish anywhere', () => {
    const b = groupPositionBounds(GAMES)
    expect(b['United States']).toEqual({ best: 1, worst: 4 })
    expect(b.Qatar).toEqual({ best: 1, worst: 4 })
  })

  it('reports all 24 orderings of a four-team group as reachable', () => {
    expect(reachableOrderings('A', GAMES).size).toBe(24)
  })
})

describe('partial first-round groups', () => {
  // US and Greece have each won twice; Dominican Republic and Nigeria have lost
  // twice. Whatever happens, US and Greece finish 1st and 2nd in some order.
  const twoRounds = A([
    ['United States', 'Nigeria', 90, 60],
    ['Greece', 'Dominican Republic', 90, 60],
    ['United States', 'Dominican Republic', 90, 60],
    ['Nigeria', 'Greece', 60, 90],
  ])

  it('clinches a top-two place without pinning the placing', () => {
    const clinch = computeClinch(twoRounds)
    expect(clinch['United States']).toBe('advanced')
    expect(clinch.Greece).toBe('advanced')
    expect(groupPositionBounds(twoRounds)['United States']).toEqual({ best: 1, worst: 2 })
  })

  it('eliminates the two that can no longer reach the top two', () => {
    const clinch = computeClinch(twoRounds)
    expect(clinch['Dominican Republic']).toBe('eliminated')
    expect(clinch.Nigeria).toBe('eliminated')
  })

  it('claims nothing after only one round', () => {
    const clinch = computeClinch(A([['United States', 'Nigeria', 90, 60]]))
    for (const v of Object.values(clinch)) expect(v).toBeNull()
  })

  it('treats a live game as unplayed', () => {
    const live = twoRounds.map((g) =>
      g.stage === 'R1' && g.group === 'A' && g.score
        ? { ...g, live: { clock: '2:00', period: 'Q4' } }
        : g,
    )
    // With every group-A game live, nothing is final, so nothing clinches.
    for (const v of Object.values(computeClinch(live))) expect(v).toBeNull()
  })

  it('ignores a voided game', () => {
    const voided = A([['United States', 'Nigeria', 90, 60]]).map((g) =>
      g.stage === 'R1' && g.group === 'A' && g.score ? { ...g, voided: true } : g,
    )
    expect(groupPositionBounds(voided)['United States']).toEqual({ best: 1, worst: 4 })
  })
})

describe('conservatism', () => {
  it('refuses to order teams whose meeting has not happened', () => {
    const board = A([
      ['United States', 'Nigeria', 90, 60],
      ['Greece', 'Dominican Republic', 90, 60],
      ['United States', 'Dominican Republic', 90, 60],
      ['Nigeria', 'Greece', 60, 90],
    ])
    const b = groupPositionBounds(board)
    expect(b['United States']).toEqual({ best: 1, worst: 2 })
    expect(b.Greece).toEqual({ best: 1, worst: 2 })
    expect(b['Dominican Republic']).toEqual({ best: 3, worst: 4 })
    expect(b.Nigeria).toEqual({ best: 3, worst: 4 })
  })

  it('collapses the range as soon as the deciding game is final', () => {
    const board = A([
      ['United States', 'Nigeria', 90, 60],
      ['Greece', 'Dominican Republic', 90, 60],
      ['United States', 'Dominican Republic', 90, 60],
      ['Nigeria', 'Greece', 60, 90],
      ['United States', 'Greece', 80, 70],
    ])
    const b = groupPositionBounds(board)
    expect(b['United States']).toEqual({ best: 1, worst: 1 })
    expect(b.Greece).toEqual({ best: 2, worst: 2 })
  })
})

describe('the second round', () => {
  const afterR1 = playStage('R1', GAMES)
  const afterR2 = playStage('R2', resolveBracket(afterR1))

  it('claims nothing before the second round is seeded', () => {
    expect(computeClinchR2(GAMES)).toEqual({})
    expect(groupPositionBoundsR2(GAMES)).toEqual({})
  })

  it('marks the finished second-round group like a first-round one', () => {
    const clinch = computeClinchR2(afterR2)
    // Group I ranks US 3-0, Serbia 2-1, Greece 1-2, Lithuania 0-3.
    expect(clinch['United States']).toBe('won-group')
    expect(clinch.Serbia).toBe('advanced')
    expect(clinch.Lithuania).toBe('eliminated')
    expect(groupPositionBoundsR2(afterR2)['United States']).toEqual({ best: 1, worst: 1 })
  })
})

describe('change detection and presentation', () => {
  it('reports only what a new batch of results settled', () => {
    const before = A([['United States', 'Nigeria', 90, 60]]) // one round: nothing settled
    const after = A(DECISIVE)
    const changes = newlyClinched(before, after)
    const byTeam = Object.fromEntries(changes.map((c) => [c.team, c.status]))
    expect(byTeam['United States']).toBe('won-group')
    expect(byTeam.Nigeria).toBe('eliminated')
    expect(changes.every((c) => c.group === 'A')).toBe(true)
  })

  it('writes a headline for every status it emits', () => {
    for (const status of ['won-group', 'advanced', 'eliminated']) {
      const line = clinchHeadline({ team: 'United States', group: 'A', status })
      expect(line).toContain('United States')
      expect(line.length).toBeGreaterThan(10)
    }
    expect(clinchHeadline({ team: 'United States', group: 'A', status: 'won-group' })).toMatch(/WON/)
  })

  it('badges every status and nothing else', () => {
    for (const status of ['won-group', 'advanced', 'eliminated']) {
      const b = clinchBadge(status)
      expect(b.label).toBeTruthy()
      expect(b.title).toBeTruthy()
    }
    expect(clinchBadge(null)).toBeNull()
    expect(clinchBadge('nonsense')).toBeNull()
  })
})
