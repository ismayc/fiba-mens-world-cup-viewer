// "My services": which of this tournament's games a viewer can actually watch.
//
// US rights for 2027 are not yet announced, so every committed game ships with an
// empty `tv` and reads as "coverage not announced" rather than "unwatchable". The
// catalog and matchers are carried from the women's edition as a plausible default
// (both streamers plus the linear bundles); the logic is exercised with synthetic
// broadcast lists so it is ready when the real rights land.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  SERVICE_BY_KEY,
  SERVICE_CATALOG,
  SERVICE_KEYS,
  broadcastNotBadged,
  coverageSummary,
  hasKnownBroadcast,
  isWatchable,
  watchableServices,
} from '../src/utils/watch.js'

const HBO = ['HBO Max']
const DAZN = ['DAZN']
const CABLE = ['TNT', 'truTV']
const UNANNOUNCED = { num: 99, stage: 'QF', tv: [] }
const num = (n) => GAMES.find((g) => g.num === n)

describe('the catalog', () => {
  it('offers both streaming services and the live-TV bundles', () => {
    expect(SERVICE_CATALOG.map((s) => s.key)).toEqual([
      'dazn', 'hbomax', 'youtubetv', 'hulu', 'fubo', 'sling', 'directv', 'cable',
    ])
    expect(SERVICE_BY_KEY.dazn.kind).toBe('stream')
    expect(SERVICE_BY_KEY.hbomax.kind).toBe('stream')
    expect(SERVICE_BY_KEY.cable.kind).toBe('bundle')
    expect(SERVICE_KEYS).toHaveLength(SERVICE_CATALOG.length)
  })

  it('gives every entry a label and a matcher', () => {
    for (const s of SERVICE_CATALOG) {
      expect(s.label).toBeTruthy()
      expect(typeof s.match).toBe('function')
      expect(['stream', 'bundle']).toContain(s.kind)
    }
  })

  it('keeps both streamers out of every live-TV bundle', () => {
    for (const s of SERVICE_CATALOG.filter((x) => x.kind === 'bundle')) {
      expect(s.match(HBO), s.key).toBe(false)
      expect(s.match(DAZN), s.key).toBe(false)
      expect(s.match(CABLE), s.key).toBe(true)
    }
    expect(SERVICE_BY_KEY.hbomax.match(HBO)).toBe(true)
    expect(SERVICE_BY_KEY.hbomax.match(CABLE)).toBe(false)
    expect(SERVICE_BY_KEY.dazn.match(DAZN)).toBe(true)
    expect(SERVICE_BY_KEY.dazn.match(HBO)).toBe(false)
  })

  it('matches a game carried on any of the three linear networks', () => {
    expect(SERVICE_BY_KEY.cable.match(['TNT'])).toBe(true)
    expect(SERVICE_BY_KEY.cable.match(['TBS'])).toBe(true)
    expect(SERVICE_BY_KEY.cable.match(['truTV'])).toBe(true)
    expect(SERVICE_BY_KEY.cable.match(['Some Other Channel'])).toBe(false)
  })
})

describe('hasKnownBroadcast', () => {
  // No committed game has a published platform yet (2027 rights unannounced), so
  // every one reads as "coverage not announced". A game WITH a list is true.
  it('is false for every committed game, true only with a platform', () => {
    for (const g of GAMES) expect(hasKnownBroadcast(g), `game ${g.num}`).toBe(false)
    expect(hasKnownBroadcast({ tv: CABLE })).toBe(true)
    expect(hasKnownBroadcast(UNANNOUNCED)).toBe(false)
    expect(hasKnownBroadcast({})).toBe(false)
    expect(hasKnownBroadcast(undefined)).toBe(false)
  })
})

describe('watchableServices', () => {
  it('lists the selected services that carry the game, in catalog order', () => {
    expect(watchableServices(CABLE, ['cable', 'youtubetv']).map((s) => s.key)).toEqual([
      'youtubetv',
      'cable',
    ])
  })

  it('lists nothing when the viewer has picked none', () => {
    expect(watchableServices(HBO, [])).toEqual([])
    expect(watchableServices(HBO, undefined)).toEqual([])
  })

  it('lists nothing when the broadcast is unknown', () => {
    expect(watchableServices([], ['cable'])).toEqual([])
    expect(watchableServices(undefined, ['cable'])).toEqual([])
  })

  it('lists nothing when no selected service carries it', () => {
    expect(watchableServices(HBO, ['cable', 'sling'])).toEqual([])
  })
})

describe('isWatchable', () => {
  it('keeps every game when nothing is selected', () => {
    expect(isWatchable(num(1), [])).toBe(true)
    expect(isWatchable(num(1), undefined)).toBe(true)
  })

  it('keeps a game a selected service carries, drops one it does not', () => {
    expect(isWatchable({ tv: CABLE }, ['cable'])).toBe(true)
    expect(isWatchable({ tv: HBO }, ['cable'])).toBe(false)
    expect(isWatchable({ tv: HBO }, ['hbomax'])).toBe(true)
  })

  // A game whose coverage is not announced is KEPT, not dropped, from a filtered
  // schedule. Every committed game is in this state for now.
  it('KEEPS a game whose coverage is not announced', () => {
    expect(isWatchable(UNANNOUNCED, ['cable'])).toBe(true)
    expect(isWatchable(num(1), ['cable'])).toBe(true)
  })
})

describe('broadcastNotBadged', () => {
  it('drops a network already named by a personalized badge', () => {
    expect(broadcastNotBadged(HBO, watchableServices(HBO, ['hbomax']))).toEqual([])
  })

  it('keeps the network behind a bundle badge, since the names differ', () => {
    expect(broadcastNotBadged(CABLE, watchableServices(CABLE, ['cable']))).toEqual(CABLE)
  })

  it('keeps everything when nothing is badged', () => {
    expect(broadcastNotBadged(CABLE, [])).toEqual(CABLE)
    expect(broadcastNotBadged(CABLE, undefined)).toEqual(CABLE)
  })

  it('returns nothing for an unknown broadcast', () => {
    expect(broadcastNotBadged([], [])).toEqual([])
    expect(broadcastNotBadged(undefined, [])).toEqual([])
  })
})

describe('coverageSummary', () => {
  // With rights unannounced, the whole committed board is "unknown".
  it('counts the committed board as all unknown', () => {
    const cable = coverageSummary(GAMES, ['cable'])
    expect(cable.total).toBe(92)
    expect(cable.unknown).toBe(92)
    expect(cable.known).toBe(0)
    expect(cable.watchable).toBe(0)
  })

  // A synthetic board with real platforms exercises the watchable-counting arm.
  it('counts what a selection can watch once platforms exist', () => {
    const board = [
      { num: 1, tv: CABLE }, // linear only, no DAZN
      { num: 2, tv: ['TNT', 'truTV', 'DAZN', 'HBO Max'] },
      { num: 3, tv: ['DAZN', 'HBO Max'] }, // streaming only
      { num: 4, tv: [] }, // still unannounced
    ]
    const cable = coverageSummary(board, ['cable'])
    expect(cable.total).toBe(4)
    expect(cable.unknown).toBe(1)
    expect(cable.known).toBe(3)
    expect(cable.watchable).toBe(2) // games 1 and 2 carry a linear network
    expect(coverageSummary(board, ['dazn']).watchable).toBe(2) // games 2 and 3 stream on DAZN
    expect(coverageSummary(board, []).watchable).toBe(0)
  })
})
