// The second-round / knockout live overlay.
//
// A slot's teams are unknown until `resolveBracket` fills them from the results
// upstream, and resolution happens downstream of the first live overlay, so App
// runs the overlay a SECOND time over the resolved schedule. When ESPN publishes
// a fixture under an id we have not committed (its real id differs from our
// placeholder id), that record survives `unclaimedLive` and matches the resolved
// slot by team pair. These tests hold that second pass in place.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('../src/data/games.js', async (importOriginal) => ({
  ...(await importOriginal()),
  GAMES: (await import('./fixtures/pretournament-games.js')).GAMES,
}))

import App from '../src/App.jsx'
import { FollowProvider } from '../src/context/follow.jsx'
import { PathProvider } from '../src/context/path.jsx'
import { GAMES } from './fixtures/pretournament-games.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { applyLive, fetchLive, unclaimedLive } from '../src/services/espn.js'
import { pairKey } from '../src/services/teamNames.js'
import { playStage, espnScoreboard, pinClock } from './helpers/tournament.js'

const num = (games, n) => games.find((g) => g.num === n)
const mockFeed = (payload) => (global.fetch = vi.fn(async () => ({ ok: true, json: async () => payload })))

// A fixture as ESPN publishes it on the day, under an id we have never committed.
// `away` is FIBA's first-named side, the orientation every committed record uses.
function liveEvent(away, home, score, id = '401999001', state = 'in') {
  const date = '2023-09-01T10:00Z'
  const status = {
    period: state === 'pre' ? 0 : 3,
    displayClock: '4:12',
    type: {
      state,
      name: `STATUS_${state === 'post' ? 'FINAL' : state === 'in' ? 'IN_PROGRESS' : 'SCHEDULED'}`,
      completed: state === 'post',
      description: state === 'post' ? 'Final' : 'In Progress',
      shortDetail: '',
    },
  }
  return {
    id,
    date,
    status,
    competitions: [
      {
        id,
        date,
        neutralSite: true,
        venue: { id: '10001', fullName: 'x' },
        status,
        competitors: [
          { homeAway: 'away', score: String(score[0]), team: { id: '1', displayName: away } },
          { homeAway: 'home', score: String(score[1]), team: { id: '2', displayName: home } },
        ],
      },
    ],
  }
}

// The second round is played September 1 and 3, 2023; pin the clock during the
// first second-round day so the App test's day section is not collapsed as past.
const DURING_R2 = new Date('2023-09-01T09:00:00Z')

beforeEach(() => pinClock(DURING_R2))
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('unclaimedLive', () => {
  it('drops every record a committed game already owns by id', async () => {
    const g1 = num(GAMES, 1) // Angola v Italy, committed id 401300001
    mockFeed(espnScoreboard([g1], { 1: { state: 'post', score: [88, 61] } }))
    const live = await fetchLive()
    const pk = pairKey('Angola', 'Italy')
    expect(live.get(pk)).toBeTruthy()
    const filtered = unclaimedLive(live, GAMES)
    expect(filtered.get(pk)).toBeUndefined()
    expect(filtered.get('id:' + g1.espnId)).toBeUndefined()
  })

  it('keeps a fixture no committed game has an id for', async () => {
    mockFeed({ events: [liveEvent('United States', 'Serbia', [44, 38])] })
    const live = await fetchLive()
    expect(unclaimedLive(live, GAMES).get(pairKey('United States', 'Serbia'))).toBeTruthy()
  })

  it('passes an empty map straight through', () => {
    expect(unclaimedLive(null, GAMES)).toBe(null)
    const empty = new Map()
    expect(unclaimedLive(empty, GAMES)).toBe(empty)
  })

  it('returns the map unchanged when nothing is committed to claim it', async () => {
    mockFeed({ events: [liveEvent('United States', 'Serbia', [44, 38])] })
    const live = await fetchLive()
    expect(unclaimedLive(live, [{ num: 1, espnId: null }])).toBe(live)
  })
})

describe('the second overlay pass', () => {
  it('scores a resolved second-round game whose ESPN id differs from the committed one', async () => {
    const board = playStage('R1') // real first-round results
    mockFeed({ events: [liveEvent('Serbia', 'Dominican Republic', [80, 74])] })
    const live = await fetchLive()

    const resolved = resolveBracket(board)
    const before = num(resolved, 49)
    expect(before.t1).toBe('Serbia')
    expect(before.t2).toBe('Dominican Republic')
    // The first pass cannot match it: the live record's id is not our committed
    // one, and the unresolved committed board has no pair for it.
    expect(applyLive(board, live).find((g) => g.num === 49).score).toBeUndefined()

    const after = num(applyLive(resolved, unclaimedLive(live, GAMES)), 49)
    // Our records are [t1, t2] and t1 is ESPN's away side, so the pair is
    // reversed back on the way in.
    expect(after.score).toEqual([80, 74])
    expect(after.live).toBeTruthy()
  })

  it('does not let a group meeting supply a knockout slot with the same pair', async () => {
    // Angola v Italy is game 1 and carries a committed id. If a later
    // round ever pairs them again, the knockout slot must stay unscored rather
    // than adopt the group result, because `pairKey` is not scoped to a date.
    const board = playStage('R1')
    mockFeed(espnScoreboard([num(GAMES, 1)], { 1: { state: 'post', score: [88, 61] } }))
    const live = await fetchLive()
    const resolved = resolveBracket(board).map((g) =>
      g.num === 89 ? { ...g, t1: 'Angola', t2: 'Italy' } : g,
    )
    const after = num(applyLive(resolved, unclaimedLive(live, GAMES)), 89)
    expect(after.score).toBeUndefined()
    // The group game itself keeps its committed result: a committed score always
    // wins over the feed.
    expect(num(applyLive(resolved, live), 1).score).toEqual([70, 90])
  })
})

describe('the app', () => {
  it('shows a live second-round score without waiting for a refresh', async () => {
    const played = playStage('R1')
    mockFeed({
      events: [...espnScoreboard(played).events, liveEvent('Serbia', 'Dominican Republic', [80, 74])],
    })
    render(
      <FollowProvider>
        <PathProvider>
          <App />
        </PathProvider>
      </FollowProvider>,
    )

    await waitFor(() => {
      const cards = [...document.querySelectorAll('.card')]
      const r2 = cards.find(
        (c) => c.textContent.includes('Serbia') && c.textContent.includes('Dominican Republic'),
      )
      expect(r2, 'no card for the resolved Serbia v Dominican Republic second-round game').toBeTruthy()
      expect(r2.querySelector('.score')?.textContent).toMatch(/80.*74/)
    })
  })
})
