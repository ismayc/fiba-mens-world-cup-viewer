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

// Group A completed: Italy 3-0, Dominican Republic 2-1, Philippines 1-2, Angola 0-3.
const DECISIVE = [
  ['Italy', 'Angola', 90, 60],
  ['Italy', 'Philippines', 90, 60],
  ['Italy', 'Dominican Republic', 90, 60],
  ['Dominican Republic', 'Philippines', 90, 60],
  ['Dominican Republic', 'Angola', 90, 60],
  ['Philippines', 'Angola', 90, 60],
]

describe('a completed first-round group', () => {
  const done = A(DECISIVE)
  const clinch = computeClinch(done)

  it('marks the winner, the other qualifier, and the eliminated pair', () => {
    expect(clinch['Italy']).toBe('won-group')
    expect(clinch['Dominican Republic']).toBe('advanced')
    expect(clinch.Philippines).toBe('eliminated')
    expect(clinch.Angola).toBe('eliminated')
  })

  it('locks every position', () => {
    const b = groupPositionBounds(done)
    expect(b['Italy']).toEqual({ best: 1, worst: 1 })
    expect(b['Dominican Republic']).toEqual({ best: 2, worst: 2 })
    expect(b.Philippines).toEqual({ best: 3, worst: 3 })
    expect(b.Angola).toEqual({ best: 4, worst: 4 })
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
    expect(b['Italy']).toEqual({ best: 1, worst: 4 })
    expect(b.Lebanon).toEqual({ best: 1, worst: 4 })
  })

  it('reports all 24 orderings of a four-team group as reachable', () => {
    expect(reachableOrderings('A', GAMES).size).toBe(24)
  })
})

describe('partial first-round groups', () => {
  // Italy and Dominican Republic have each won twice; Philippines and Angola have
  // lost twice. Whatever happens, Italy and Dominican Republic finish 1st and 2nd in
  // some order.
  const twoRounds = A([
    ['Italy', 'Angola', 90, 60],
    ['Dominican Republic', 'Philippines', 90, 60],
    ['Italy', 'Philippines', 90, 60],
    ['Angola', 'Dominican Republic', 60, 90],
  ])

  it('clinches a top-two place without pinning the placing', () => {
    const clinch = computeClinch(twoRounds)
    expect(clinch['Italy']).toBe('advanced')
    expect(clinch['Dominican Republic']).toBe('advanced')
    expect(groupPositionBounds(twoRounds)['Italy']).toEqual({ best: 1, worst: 2 })
  })

  it('eliminates the two that can no longer reach the top two', () => {
    const clinch = computeClinch(twoRounds)
    expect(clinch.Philippines).toBe('eliminated')
    expect(clinch.Angola).toBe('eliminated')
  })

  it('claims nothing after only one round', () => {
    const clinch = computeClinch(A([['Italy', 'Angola', 90, 60]]))
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
    const voided = A([['Italy', 'Angola', 90, 60]]).map((g) =>
      g.stage === 'R1' && g.group === 'A' && g.score ? { ...g, voided: true } : g,
    )
    expect(groupPositionBounds(voided)['Italy']).toEqual({ best: 1, worst: 4 })
  })
})

describe('conservatism', () => {
  it('refuses to order teams whose meeting has not happened', () => {
    const board = A([
      ['Italy', 'Angola', 90, 60],
      ['Dominican Republic', 'Philippines', 90, 60],
      ['Italy', 'Philippines', 90, 60],
      ['Angola', 'Dominican Republic', 60, 90],
    ])
    const b = groupPositionBounds(board)
    expect(b['Italy']).toEqual({ best: 1, worst: 2 })
    expect(b['Dominican Republic']).toEqual({ best: 1, worst: 2 })
    expect(b.Philippines).toEqual({ best: 3, worst: 4 })
    expect(b.Angola).toEqual({ best: 3, worst: 4 })
  })

  it('collapses the range as soon as the deciding game is final', () => {
    const board = A([
      ['Italy', 'Angola', 90, 60],
      ['Dominican Republic', 'Philippines', 90, 60],
      ['Italy', 'Philippines', 90, 60],
      ['Angola', 'Dominican Republic', 60, 90],
      ['Italy', 'Dominican Republic', 80, 70],
    ])
    const b = groupPositionBounds(board)
    expect(b['Italy']).toEqual({ best: 1, worst: 1 })
    expect(b['Dominican Republic']).toEqual({ best: 2, worst: 2 })
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
    // With the full-carryover model, group I ranks Serbia 5-0, Italy 4-1,
    // Puerto Rico 3-2, Dominican Republic 2-3.
    expect(clinch.Serbia).toBe('won-group')
    expect(clinch['Italy']).toBe('advanced')
    expect(clinch['Dominican Republic']).toBe('eliminated')
    expect(groupPositionBoundsR2(afterR2)['Serbia']).toEqual({ best: 1, worst: 1 })
  })
})

describe('change detection and presentation', () => {
  it('reports only what a new batch of results settled', () => {
    const before = A([['Italy', 'Angola', 90, 60]]) // one round: nothing settled
    const after = A(DECISIVE)
    const changes = newlyClinched(before, after)
    const byTeam = Object.fromEntries(changes.map((c) => [c.team, c.status]))
    expect(byTeam['Italy']).toBe('won-group')
    expect(byTeam.Angola).toBe('eliminated')
    expect(changes.every((c) => c.group === 'A')).toBe(true)
  })

  it('writes a headline for every status it emits', () => {
    for (const status of ['won-group', 'advanced', 'eliminated']) {
      const line = clinchHeadline({ team: 'Italy', group: 'A', status })
      expect(line).toContain('Italy')
      expect(line.length).toBeGreaterThan(10)
    }
    expect(clinchHeadline({ team: 'Italy', group: 'A', status: 'won-group' })).toMatch(/WON/)
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
