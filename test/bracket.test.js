// The knockout bracket: topology, slot grammar and route tracing.
//
// The topology assertions are the verified 2023 wiring (the working default until
// FIBA publishes the 2027 sheet). They exist because a tidier, wrong crossover is
// an easy thing to introduce by accident, and it would let two teams from one
// second-round group meet before the Final.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  BRACKET,
  feederTeams,
  gamesByNum,
  groupSlotMap,
  knockoutTeams,
  pathToFinal,
} from '../src/utils/bracket.js'
import { ENTRY_ROUND, groupFedGames, groupPlacing, slotLabels } from '../src/utils/slots.js'

const byNum = gamesByNum(GAMES)
const labelsOf = (num) => slotLabels(byNum[num])
const put = (num, patch) => gamesByNum(GAMES.map((g) => (g.num === num ? { ...g, ...patch } : g)))

describe('the wiring', () => {
  it('feeds every quarter-final from two second-round group placings', () => {
    expect(ENTRY_ROUND).toBe('QF')
    expect(labelsOf(85)).toEqual(['Winner Group I', '2nd Group J'])
    expect(labelsOf(86)).toEqual(['Winner Group J', '2nd Group I'])
    expect(labelsOf(87)).toEqual(['Winner Group K', '2nd Group L'])
    expect(labelsOf(88)).toEqual(['Winner Group L', '2nd Group K'])
  })

  // The crossover: I<->J and K<->L. A group's winner and runner-up are placed in
  // opposite halves, so they can only meet again in the Final.
  it('crosses I<->J and K<->L so a group cannot rematch before the Final', () => {
    // 1st I is in game 85 (left half), 2nd I in game 86 (right half).
    const half = (num) => (BRACKET.left.QF.includes(num) ? 'left' : 'right')
    for (const key of ['I', 'J', 'K', 'L']) {
      const map = groupSlotMap(GAMES)
      expect(half(map[key].win)).not.toBe(half(map[key].second))
    }
  })

  it('pairs the semi-finals across the halves', () => {
    expect(labelsOf(89)).toEqual(['Winner Game 85', 'Winner Game 87'])
    expect(labelsOf(90)).toEqual(['Winner Game 86', 'Winner Game 88'])
  })

  it('feeds the third-place game from the two beaten semi-finalists', () => {
    expect(labelsOf(91)).toEqual(['Loser Game 89', 'Loser Game 90'])
    expect(labelsOf(92)).toEqual(['Winner Game 89', 'Winner Game 90'])
  })
})

describe('the rendered layout', () => {
  it('is a balanced 4-4 bracket meeting only at the Final', () => {
    expect(BRACKET.left).toEqual({ QF: [85, 87], SF: [89] })
    expect(BRACKET.right).toEqual({ QF: [86, 88], SF: [90] })
    expect(BRACKET.final).toEqual([92])
    expect(BRACKET.third).toEqual([91])
  })

  it('lays out every knockout game exactly once', () => {
    const laid = [
      ...Object.values(BRACKET.left).flat(),
      ...Object.values(BRACKET.right).flat(),
      ...BRACKET.final,
      ...BRACKET.third,
    ].sort((a, b) => a - b)
    expect(laid).toEqual([85, 86, 87, 88, 89, 90, 91, 92])
  })

  it('gives each half two quarter-finals feeding one semi-final', () => {
    expect(BRACKET.left.QF).toHaveLength(2)
    expect(BRACKET.right.QF).toHaveLength(2)
    expect(BRACKET.left.SF).toHaveLength(1)
    expect(BRACKET.right.SF).toHaveLength(1)
  })
})

describe('group routes', () => {
  it('maps each second-round group’s two placings to their quarter-finals', () => {
    const map = groupSlotMap(GAMES)
    expect(map.I).toEqual({ win: 85, second: 86 })
    expect(map.J).toEqual({ win: 86, second: 85 })
    expect(map.K).toEqual({ win: 87, second: 88 })
    expect(map.L).toEqual({ win: 88, second: 87 })
  })

  it('routes both placings of every group to a quarter-final', () => {
    const map = groupSlotMap(GAMES)
    for (const key of ['I', 'J', 'K', 'L']) {
      expect(byNum[map[key].win].stage).toBe('QF')
      expect(byNum[map[key].second].stage).toBe('QF')
    }
  })

  it('reads labels from a record whose teams are already resolved', () => {
    const resolved = { ...byNum[85], t1: 'United States', t2: 'Serbia' }
    expect(slotLabels(resolved)).toEqual(['Winner Group I', '2nd Group J'])
  })

  it('parses a quarter-final slot to a group placing', () => {
    expect(groupPlacing(labelsOf(85)[0])).toEqual({ group: 'I', place: 1 })
  })
})

describe('feeder expansion', () => {
  it('expands a feed slot once its source game has two real teams', () => {
    const resolved = put(85, { t1: 'United States', t2: 'Serbia' })
    expect(feederTeams('Winner Game 85', resolved)).toEqual({
      a: 'United States',
      b: 'Serbia',
      kind: 'Winner',
      num: 85,
    })
    expect(feederTeams('Loser Game 85', resolved).kind).toBe('Loser')
  })

  it('expands nothing for a real team, a group label, an unresolved source, or no map', () => {
    expect(feederTeams('United States', byNum)).toBeNull()
    expect(feederTeams('Winner Group I', byNum)).toBeNull()
    expect(feederTeams('Winner Game 85', byNum)).toBeNull()
    expect(feederTeams('Winner Game 85', null)).toBeNull()
  })
})

describe('path to the Final', () => {
  it('traces a quarter-finalist inward to the Final', () => {
    const resolved = put(85, { t1: 'United States' })
    const p = pathToFinal('United States', resolved)
    expect(p.entry).toBe('QF')
    expect(p.nums).toEqual([85, 89, 92])
  })

  it('marks where a team went out and stops the highlight there', () => {
    const board = gamesByNum(
      GAMES.map((g) => {
        if (g.num === 85) return { ...g, t1: 'United States', t2: 'Serbia', score: [70, 80] }
        return g
      }),
    )
    const p = pathToFinal('United States', board)
    expect(p.here).toEqual([85])
    expect(p.exitNum).toBe(85)
    expect(p.active).toEqual([85])
  })

  it('keeps the whole route active while a team is alive', () => {
    const board = put(85, { t1: 'United States', t2: 'Serbia', score: [90, 70] })
    const p = pathToFinal('United States', board)
    expect(p.exitNum).toBeNull()
    expect(p.active).toEqual(p.nums)
  })

  it('takes the earliest game when a team somehow appears in two group-fed slots', () => {
    // Defensive: pathToFinal sorts a team's entry games and enters at the earliest.
    const board = gamesByNum(
      GAMES.map((g) => {
        if (g.num === 87) return { ...g, t1: 'United States' }
        if (g.num === 85) return { ...g, t1: 'United States' }
        return g
      }),
    )
    expect(pathToFinal('United States', board).nums[0]).toBe(85)
  })

  it('returns nothing for a team not in the knockout, or for none', () => {
    expect(pathToFinal('United States', byNum)).toBeNull()
    expect(pathToFinal(null, byNum)).toBeNull()
  })

  it('lists the real teams that have reached the knockout', () => {
    expect(knockoutTeams(byNum)).toEqual([])
    const resolved = put(85, { t1: 'United States', t2: 'Serbia' })
    expect(knockoutTeams(resolved)).toEqual(['Serbia', 'United States'])
  })
})
