// The ESPN live overlay.
//
// The committed schedule is the source of record; this layer only adds what a
// live feed can know. The tests that matter are about what it must NOT do:
// overwrite a committed score, rewrite teams on a game it matched by id, or treat
// a live score as final.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  ESPN_ALIASES,
  LIVE_SOURCE,
  applyLive,
  fetchLive,
  historyDates,
  liveRecordFor,
  overtimeFrom,
  periodLabel,
  scoreboardDates,
  unclaimedLive,
  REGULATION_PERIODS,
} from '../src/services/espn.js'
import { espnScoreboard } from './helpers/tournament.js'

const num = (games, n) => games.find((g) => g.num === n)
// Game 1: Angola v Italy, 2023-08-25 16:00 +08:00 = 08:00Z, Philippine Arena.
const PAIR1 = 'pair:Angola|Italy'

function mockFeed(payload) {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => payload }))
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('configuration', () => {
  it('points at site.web.api and the FIBA league', () => {
    expect(LIVE_SOURCE.url).toContain('site.web.api.espn.com')
    expect(LIVE_SOURCE.url).toContain('basketball/fiba')
    expect(LIVE_SOURCE.url).not.toContain('site.api.espn.com/')
  })

  it('needs no team-name aliases for this edition', () => {
    expect(ESPN_ALIASES).toEqual({})
  })
})

describe('period arithmetic', () => {
  it('treats anything past the 4th period as overtime', () => {
    expect(REGULATION_PERIODS).toBe(4)
    expect(overtimeFrom(4)).toBe(0)
    expect(overtimeFrom(5)).toBe(1)
    expect(overtimeFrom(7)).toBe(3)
    expect(overtimeFrom(0)).toBe(0)
    expect(overtimeFrom(undefined)).toBe(0)
  })

  it('labels the period the way a scoreboard would', () => {
    expect(periodLabel(0, 'pre')).toBe('')
    expect(periodLabel(3, 'in')).toBe('Q3')
    expect(periodLabel(5, 'in')).toBe('OT')
    expect(periodLabel(6, 'in')).toBe('2OT')
    expect(periodLabel(2, 'in', 'End of the 2nd Half')).toBe('Half')
    expect(periodLabel(4, 'post')).toBe('Final')
    expect(periodLabel(0, 'in')).toBe('')
  })
})

describe('date windows', () => {
  it('asks for yesterday, today and tomorrow', () => {
    const dates = scoreboardDates(new Date('2023-08-30T12:00:00Z'))
    expect(dates).toEqual(['20230829', '20230830', '20230831'])
  })

  // ESPN buckets a dates= query by the US-EASTERN day. Game 1 tips at 08:00Z,
  // which is 04:00 in New York the same day.
  it('backfills a past game under ESPN’s Eastern day', () => {
    const g = num(GAMES, 1)
    const dates = historyDates([g], new Date('2023-09-10T12:00:00Z'))
    expect(dates).toEqual(['20230825'])
  })

  it('skips games that have not tipped off, and those inside the live window', () => {
    expect(historyDates(GAMES, new Date('2023-08-20T12:00:00Z'))).toEqual([])
    const g = num(GAMES, 1)
    expect(historyDates([g], new Date('2023-08-25T20:00:00Z'))).toEqual([])
  })

  it('ignores a game with no tip-off time', () => {
    expect(historyDates([{ ...num(GAMES, 85), ko: null }], new Date('2023-09-20T12:00:00Z'))).toEqual([])
  })
})

describe('fetchLive', () => {
  it('indexes each game by id, team pair and instant', async () => {
    mockFeed(espnScoreboard([num(GAMES, 1)], { 1: { state: 'post', score: [88, 61] } }))
    const map = await fetchLive()
    expect(map.get('id:' + num(GAMES, 1).espnId)).toBeTruthy()
    expect(map.get(PAIR1)).toBeTruthy()
    expect(map.get('inst:' + new Date(num(GAMES, 1).ko).getTime())).toBeTruthy()
  })

  it('throws when no scoreboard date can be reached', async () => {
    global.fetch = vi.fn(async () => ({ ok: false }))
    await expect(fetchLive()).rejects.toThrow(/Live request failed/)
  })

  it('returns nothing when asked for no dates', async () => {
    expect((await fetchLive(undefined, [])).size).toBe(0)
  })

  it('dedupes the same game across adjacent date queries', async () => {
    mockFeed(espnScoreboard([num(GAMES, 1)]))
    const map = await fetchLive(undefined, ['20230824', '20230825'])
    expect(map.size).toBe(3)
  })
})

describe('applyLive', () => {
  const g1 = num(GAMES, 1)

  it('does nothing without a feed', () => {
    expect(applyLive(GAMES, null)).toBe(GAMES)
    expect(applyLive(GAMES, new Map())).toBe(GAMES)
  })

  it('overlays a final score onto an unplayed game', async () => {
    mockFeed(espnScoreboard([g1], { 1: { state: 'post', score: [88, 61] } }))
    const out = applyLive(GAMES, await fetchLive())
    expect(num(out, 1).score).toEqual([88, 61])
    expect(num(out, 1).liveSource).toBe(true)
  })

  it('marks a game in progress as live, with period and clock', async () => {
    mockFeed(espnScoreboard([g1], { 1: { state: 'in', score: [40, 38], period: 2, clock: '4:12' } }))
    const out = applyLive(GAMES, await fetchLive())
    expect(num(out, 1).live).toMatchObject({ clock: '4:12', period: 'Q2' })
    expect(num(out, 1).score).toEqual([40, 38])
  })

  it('records overtime periods on a finished game', async () => {
    mockFeed(espnScoreboard([g1], { 1: { state: 'post', score: [95, 92], period: 6 } }))
    expect(num(applyLive(GAMES, await fetchLive()), 1).ot).toBe(2)
  })

  it('never overwrites a committed score', async () => {
    const committed = GAMES.map((g) => (g.num === 1 ? { ...g, score: [88, 61] } : g))
    mockFeed(espnScoreboard([g1], { 1: { state: 'post', score: [10, 99] } }))
    expect(num(applyLive(committed, await fetchLive()), 1).score).toEqual([88, 61])
  })

  it('flips the scoreline when ESPN’s home/away is the other way round', async () => {
    const feed = espnScoreboard([g1], { 1: { state: 'post', score: [88, 61] } })
    feed.events[0].competitions[0].competitors = [
      { homeAway: 'home', score: '88', team: { id: '1', displayName: 'Angola' } },
      { homeAway: 'away', score: '61', team: { id: '2', displayName: 'Italy' } },
    ]
    mockFeed(feed)
    // t1 is Angola, so its 88 must stay first.
    expect(num(applyLive(GAMES, await fetchLive()), 1).score).toEqual([88, 61])
  })

  it('voids an abandoned game so the standings ignore it', async () => {
    mockFeed(espnScoreboard([g1], { 1: { state: 'post', score: [40, 38], statusName: 'STATUS_POSTPONED' } }))
    const out = applyLive(GAMES, await fetchLive())
    expect(num(out, 1).voided).toBe(true)
    expect(num(out, 1).statusLabel).toBe('Postponed')
  })

  it('treats an ESPN "Delayed" at the scheduled hour as not yet tipped off', async () => {
    mockFeed(espnScoreboard([g1], { 1: { state: 'in', score: [0, 0], statusName: 'STATUS_DELAYED' } }))
    const map = await fetchLive()
    const out = applyLive(GAMES, map, new Date(g1.ko).getTime() + 60_000)
    expect(num(out, 1).live).toBeUndefined()
    const later = applyLive(GAMES, map, new Date(g1.ko).getTime() + 30 * 60_000)
    expect(num(later, 1).live?.delayed).toBe(true)
  })
})

describe('matching a game to its feed record', () => {
  // An unresolved knockout slot: quarter-final 85, holding placeholder teams.
  const slot = (over = {}) => ({ ...num(GAMES, 85), espnId: null, ...over })

  it('prefers the ESPN event id over anything else', async () => {
    mockFeed(espnScoreboard([num(GAMES, 1)], { 1: { state: 'post', score: [88, 61] } }))
    const rec = liveRecordFor(num(GAMES, 1), await fetchLive())
    expect(rec.id).toBe(num(GAMES, 1).espnId)
  })

  it('does not rewrite the teams of a game matched by id', async () => {
    const feed = espnScoreboard([num(GAMES, 1)], { 1: { state: 'post', score: [88, 61] } })
    feed.events[0].competitions[0].competitors[0].team.displayName = 'Spain'
    mockFeed(feed)
    const out = applyLive(GAMES, await fetchLive())
    expect(num(out, 1).t1).toBe('Angola')
    expect(num(out, 1).t2).toBe('Italy')
  })

  it('adopts ESPN’s teams for an unresolved knockout slot, matched by instant', async () => {
    const qf = slot()
    const board = GAMES.map((g) => (g.num === 85 ? qf : g))
    const feed = espnScoreboard([{ ...qf, t1: 'Spain', t2: 'Serbia', espnId: '999' }], {
      85: { state: 'post', score: [80, 70] },
    })
    mockFeed(feed)
    const out = applyLive(board, await fetchLive())
    expect(num(out, 85).t1).toBe('Spain')
    expect(num(out, 85).t2).toBe('Serbia')
    expect(num(out, 85).score).toEqual([80, 70])
    expect(num(out, 85).espnId).toBe('999')
  })

  it('pins down a TBC tip-off once ESPN publishes the fixture', async () => {
    const qf = slot({ tbdTip: true })
    const board = GAMES.map((g) => (g.num === 85 ? qf : g))
    const feed = espnScoreboard([{ ...qf, t1: 'Spain', t2: 'Serbia', espnId: '999' }])
    mockFeed(feed)
    const out = applyLive(board, await fetchLive())
    expect(num(out, 85).tbdTip).toBe(false)
    expect(new Date(num(out, 85).ko).getTime()).toBe(new Date(qf.ko).getTime())
  })

  it('pins a TBC tip-off from a SCORED feed too', async () => {
    const qf = slot({ tbdTip: true })
    const board = GAMES.map((g) => (g.num === 85 ? qf : g))
    mockFeed(
      espnScoreboard([{ ...qf, t1: 'Spain', t2: 'Serbia', espnId: '999' }], {
        85: { state: 'post', score: [80, 70] },
      }),
    )
    const out = applyLive(board, await fetchLive())
    expect(num(out, 85).tbdTip).toBe(false)
    expect(num(out, 85).score).toEqual([80, 70])
    expect(new Date(num(out, 85).ko).getTime()).toBe(new Date(qf.ko).getTime())
  })

  it('matches nothing for a game with no id, no real teams and no time', () => {
    expect(liveRecordFor(slot({ ko: null }), new Map())).toBeNull()
  })
})

describe('malformed and one-off feed records', () => {
  const g1 = num(GAMES, 1)

  it('skips an event with no competition or no competitors', async () => {
    mockFeed({ events: [{ id: '1' }, { id: '2', competitions: [{}] }] })
    expect((await fetchLive()).size).toBe(0)
  })

  it('skips an event missing one of its teams', async () => {
    mockFeed({
      events: [
        {
          id: '1',
          date: '2023-08-25T08:00Z',
          competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: 'Angola' } }] }],
        },
      ],
    })
    expect((await fetchLive()).size).toBe(0)
  })

  it('handles a payload with no events array at all', async () => {
    mockFeed({})
    expect((await fetchLive()).size).toBe(0)
  })

  it('falls back to uid when an event has no id', async () => {
    const feed = espnScoreboard([g1])
    delete feed.events[0].id
    feed.events[0].uid = 's:40~e:999'
    mockFeed(feed)
    expect((await fetchLive()).get('id:s:40~e:999')).toBeTruthy()
  })

  it('keeps an event with neither id nor uid, keyed by pair and instant', async () => {
    const feed = espnScoreboard([g1])
    delete feed.events[0].id
    mockFeed(feed)
    const map = await fetchLive()
    expect(map.get(PAIR1)).toBeTruthy()
    expect(map.get(PAIR1).id).toBeNull()
  })

  it('reads the status off the competition when the event has none', async () => {
    const feed = espnScoreboard([g1], { 1: { state: 'in', score: [40, 38], period: 2 } })
    feed.events[0].competitions[0].status = feed.events[0].status
    delete feed.events[0].status
    mockFeed(feed)
    expect((await fetchLive()).get(PAIR1).state).toBe('in')
  })

  it('defaults a status-less event to pre-game with an empty clock', async () => {
    const feed = espnScoreboard([g1])
    delete feed.events[0].status
    delete feed.events[0].competitions[0].status
    mockFeed(feed)
    const rec = (await fetchLive()).get(PAIR1)
    expect(rec.state).toBe('pre')
    expect(rec.clock).toBe('')
    expect(rec.statusLabel).toBeNull()
    expect(rec.paused).toBe(false)
  })

  it('records no instant for an event with no date', async () => {
    const feed = espnScoreboard([g1])
    delete feed.events[0].date
    mockFeed(feed)
    expect((await fetchLive()).get(PAIR1).instant).toBeNull()
  })

  it('reads no score when a competitor has none', async () => {
    const feed = espnScoreboard([g1], { 1: { state: 'post' } })
    feed.events[0].competitions[0].competitors[0].score = ''
    mockFeed(feed)
    expect((await fetchLive()).get(PAIR1).score).toBeNull()
  })

  it('labels each one-off status ESPN can report', async () => {
    const cases = [
      ['STATUS_SUSPENDED', 'Suspended'],
      ['STATUS_DELAYED', 'Delayed'],
      ['STATUS_ABANDONED', 'Abandoned'],
      ['STATUS_POSTPONED', 'Postponed'],
      ['STATUS_CANCELED', 'Canceled'],
      ['STATUS_FORFEIT', 'Awarded'],
    ]
    for (const [name, label] of cases) {
      mockFeed(espnScoreboard([g1], { 1: { state: 'post', score: [40, 38], statusName: name } }))
      expect((await fetchLive()).get(PAIR1).statusLabel, name).toBe(label)
    }
  })

  it('marks an awarded result on the merged game', async () => {
    mockFeed(espnScoreboard([g1], { 1: { state: 'post', score: [20, 0], statusName: 'STATUS_FORFEIT' } }))
    expect(num(applyLive(GAMES, await fetchLive()), 1).awarded).toBe(true)
  })

  it('voids an abandoned game that has no score at all', async () => {
    const feed = espnScoreboard([g1], { 1: { state: 'post', statusName: 'STATUS_ABANDONED' } })
    feed.events[0].competitions[0].competitors.forEach((c) => (c.score = ''))
    mockFeed(feed)
    const out = applyLive(GAMES, await fetchLive())
    expect(num(out, 1).voided).toBe(true)
    expect(num(out, 1).score).toBeUndefined()
  })

  it('adds an ESPN id to a committed game that lacks one, and leaves one it has', async () => {
    const committed = GAMES.map((g) => (g.num === 1 ? { ...g, score: [88, 61], espnId: null } : g))
    mockFeed(espnScoreboard([{ ...g1, espnId: '777' }], { 1: { state: 'post', score: [88, 61] } }))
    expect(num(applyLive(committed, await fetchLive()), 1).espnId).toBe('777')

    const already = GAMES.map((g) => (g.num === 1 ? { ...g, score: [88, 61] } : g))
    const same = applyLive(already, await fetchLive())
    expect(num(same, 1)).toBe(already.find((g) => g.num === 1))
  })

  it('ignores a date query that returns nothing usable', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => null }))
    await expect(fetchLive()).rejects.toThrow(/Live request failed/)
  })
})

describe('overlay guards', () => {
  const g1 = num(GAMES, 1)
  const slot = (over = {}) => ({ ...num(GAMES, 85), espnId: null, ...over })

  it('overlays a score even when the feed record carries no id', async () => {
    const feed = espnScoreboard([g1], { 1: { state: 'post', score: [88, 61] } })
    delete feed.events[0].id
    mockFeed(feed)
    expect(num(applyLive(GAMES, await fetchLive()), 1).score).toEqual([88, 61])
  })

  it('refuses to adopt a feed side that is not one of the teams', async () => {
    const qf = slot()
    const board = GAMES.map((g) => (g.num === 85 ? qf : g))
    mockFeed(
      espnScoreboard([{ ...qf, t1: 'TBD', t2: 'To Be Determined', espnId: '999' }], {
        85: { state: 'post', score: [80, 70] },
      }),
    )
    const out = applyLive(board, await fetchLive())
    expect(num(out, 85).t1).toBeNull()
    expect(num(out, 85).t2).toBeNull()
  })

  it('leaves a pre-game placeholder alone when the feed names no real teams', async () => {
    const qf = slot()
    const board = GAMES.map((g) => (g.num === 85 ? qf : g))
    mockFeed(espnScoreboard([{ ...qf, t1: 'TBD', t2: 'TBD 2', espnId: '999' }]))
    const out = applyLive(board, await fetchLive())
    expect(num(out, 85).t1).toBeNull()
    expect(num(out, 85).espnId).toBe('999')
  })
})

describe('unclaimedLive', () => {
  it('returns the map untouched when there is nothing to drop', () => {
    expect(unclaimedLive(null, GAMES)).toBeNull()
    const empty = new Map()
    expect(unclaimedLive(empty, GAMES)).toBe(empty)
    const map = new Map([['id:1', { id: '1' }]])
    // No committed game carries an ESPN id here, so nothing is claimed.
    expect(unclaimedLive(map, [{ num: 1, espnId: null }])).toBe(map)
  })

  it('drops the records a committed game owns by id, and keeps the rest', async () => {
    mockFeed(
      espnScoreboard([num(GAMES, 1), { ...num(GAMES, 2), espnId: '999999' }], {
        1: { state: 'post', score: [88, 61] },
        2: { state: 'post', score: [70, 65] },
      }),
    )
    const map = await fetchLive()
    const claimedId = num(GAMES, 1).espnId
    expect(map.has('id:' + claimedId)).toBe(true)
    const out = unclaimedLive(map, GAMES) // GAMES commits game 1's espn id, not '999999'
    expect(out.has('id:' + claimedId)).toBe(false)
    expect([...out.values()].some((r) => r.id === claimedId)).toBe(false)
    // A record no committed game claims survives.
    expect(out.has('id:999999')).toBe(true)
  })
})

describe('aborting a poll', () => {
  it('rethrows an abort as an AbortError, not a generic failure', async () => {
    const ctrl = new AbortController()
    global.fetch = vi.fn(
      (url, opts) =>
        new Promise((_, rej) => {
          opts.signal.addEventListener('abort', () => {
            const e = new Error('aborted')
            e.name = 'AbortError'
            rej(e)
          })
        }),
    )
    const pending = fetchLive(ctrl.signal)
    ctrl.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('still reports a genuine outage as a plain failure', async () => {
    global.fetch = vi.fn(async () => ({ ok: false }))
    await expect(fetchLive(new AbortController().signal)).rejects.toMatchObject({ name: 'Error' })
  })
})
