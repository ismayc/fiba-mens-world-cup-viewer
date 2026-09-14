// The Netlify calendar function: the auto-updating webcal:// subscription.
//
// The function has been re-pointed at the men's 2027 tournament (FEED window,
// PRODID, UID, filename, headline filter). Its VENUE_ALIASES and
// KNOWN_ESPN_TIME_BUGS are empty for now, because no men's ESPN capture exists to
// derive sponsor-name or bad-time corrections from; the app adds them when the
// 2027 feed is live. These tests exercise the function with self-contained
// men's-shaped payloads.
//
// PARENT NOTE: with VENUE_ALIASES = {} and KNOWN_ESPN_TIME_BUGS = {}, the
// `ALIASES[x] || x` and `BUGS[id] || date` expressions can never take their
// left-hand (alias-hit / bug-hit) branch, so branch coverage of those two lines
// is unreachable from any test. Add a placeholder entry or a /* v8 ignore */ once
// the 2027 feed shape is known, or the 100% gate will flag them.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handler, parseScoreboard } from '../netlify/functions/calendar.js'

const HEAD = "FIBA Men's World Cup - Group A"
const comp = (over = {}) => ({
  notes: [{ headline: HEAD }],
  status: { type: {} },
  venue: { fullName: 'Lusail Sports Arena', address: { city: 'Lusail' } },
  competitors: [
    { homeAway: 'home', score: '70', team: { displayName: 'Nigeria' } },
    { homeAway: 'away', score: '80', team: { displayName: 'United States' } },
  ],
  ...over,
})
const wrap = (competitions) => ({ events: [{ id: 'x', date: '2027-08-27T11:00Z', competitions }] })

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => wrap([comp()]) }))
})

describe('parseScoreboard', () => {
  it('reads a game of this tournament, away-first', () => {
    const [g] = parseScoreboard(wrap([comp()]))
    expect(g.away).toBe('United States')
    expect(g.home).toBe('Nigeria')
    expect(g.round).toBe('Group A')
  })

  it('keeps only games whose headline names a FIBA World Cup', () => {
    const other = comp({ notes: [{ headline: 'FIBA AmeriCup 2028 - Group A' }] })
    expect(parseScoreboard(wrap([comp(), other]))).toHaveLength(1)
  })

  it('passes the arena name through (no sponsor aliases yet)', () => {
    const [g] = parseScoreboard(wrap([comp({ venue: { fullName: 'Lusail Sports Arena', address: { city: 'Lusail' } } })]))
    expect(g.venue).toBe('Lusail Sports Arena, Lusail')
  })

  it('uses ESPN’s own tip-off time (no committed corrections yet)', () => {
    const [g] = parseScoreboard(wrap([comp()]))
    expect(g.start.toISOString()).toBe('2027-08-27T11:00:00.000Z')
  })

  it('shows no score for a game that has not been played', () => {
    expect(parseScoreboard(wrap([comp()]))[0].result).toBe('')
  })

  it('shows the score, and overtime, once a game is complete', () => {
    const [g] = parseScoreboard(
      wrap([comp({ status: { period: 6, type: { completed: true } }, competitors: [
        { homeAway: 'home', score: '92', team: { displayName: 'Nigeria' } },
        { homeAway: 'away', score: '95', team: { displayName: 'United States' } },
      ] })]),
    )
    expect(g.result).toMatch(/2OT/)
    expect(g.result).toMatch(/95–92/)
  })

  it('labels a single overtime without a number', () => {
    const [g] = parseScoreboard(wrap([comp({ status: { period: 5, type: { completed: true } } })]))
    expect(g.result).toMatch(/ OT\)$/)
    expect(g.result).not.toMatch(/1OT/)
  })

  it('skips an event with no competitors or an unreadable date', () => {
    expect(
      parseScoreboard({
        events: [
          { competitions: [{ notes: [{ headline: HEAD }] }] },
          { date: 'nonsense', competitions: [comp()] },
        ],
      }),
    ).toEqual([])
  })
})

describe('malformed upstream payloads', () => {
  it('accepts the payload as a JSON string as well as an object', () => {
    expect(parseScoreboard(JSON.stringify(wrap([comp()])))).toHaveLength(1)
  })

  it('reads an empty calendar out of a payload with no events at all', () => {
    expect(parseScoreboard({})).toEqual([])
    expect(parseScoreboard(null)).toEqual([])
  })

  it('skips an event whose competition carries no usable notes', () => {
    expect(parseScoreboard(wrap([comp({ notes: undefined })]))).toEqual([])
    expect(parseScoreboard(wrap([comp({ notes: [{}] })]))).toEqual([])
  })

  it('leaves the location blank rather than throwing when the venue is missing', () => {
    expect(parseScoreboard(wrap([comp({ venue: undefined })]))[0].venue).toBe('')
    expect(parseScoreboard(wrap([comp({ venue: { fullName: 'Lusail Sports Arena' } })]))[0].venue).toBe('Lusail Sports Arena')
  })

  it('treats a competitor with no team as unnamed rather than crashing', () => {
    const [g] = parseScoreboard(
      wrap([comp({ competitors: [
        { homeAway: 'home', score: '70', team: undefined },
        { homeAway: 'away', score: '80', team: { displayName: 'United States' } },
      ] })]),
    )
    expect(g.home).toBe('')
    expect(g.away).toBe('United States')
  })

  it('shows no score when a completed game reports an empty one', () => {
    const [g] = parseScoreboard(
      wrap([comp({ status: { period: 4, type: { completed: true } }, competitors: [
        { homeAway: 'home', score: '', team: { displayName: 'Nigeria' } },
        { homeAway: 'away', score: '80', team: { displayName: 'United States' } },
      ] })]),
    )
    expect(g.result).toBe('')
  })

  it('uses the whole headline as the round when it carries no dash', () => {
    const [g] = parseScoreboard(wrap([comp({ notes: [{ headline: "FIBA Men's World Cup" }] })]))
    expect(g.round).toBe("FIBA Men's World Cup")
  })

  it('adds no overtime label to a game that reports no period', () => {
    const [g] = parseScoreboard(wrap([comp({ status: { type: { completed: true } } })]))
    expect(g.result).toBe(' (80–70)')
  })
})

describe('handler', () => {
  it('serves a calendar naming this tournament', async () => {
    const res = await handler({ queryStringParameters: {} })
    expect(res.statusCode).toBe(200)
    expect(res.headers['Content-Type']).toMatch(/text\/calendar/)
    expect(res.body).toContain("X-WR-CALNAME:FIBA Men's World Cup 2027")
    expect(res.body).toContain("PRODID:-//FIBA Men's World Cup 2027 Viewer//EN")
    expect(res.body.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(res.body).not.toMatch(/Women/)
  })

  it('filters to the requested teams', async () => {
    const res = await handler({ queryStringParameters: { teams: 'United States' } })
    expect(res.body.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(res.body).toContain('My Teams')
    const none = await handler({ queryStringParameters: { teams: 'Nowhere' } })
    expect(none.body).not.toContain('BEGIN:VEVENT')
  })

  it('reports an upstream failure rather than serving an empty calendar', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 503 }))
    expect((await handler({ queryStringParameters: {} })).statusCode).toBe(502)
  })

  it('reports a thrown error', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('boom')
    })
    const res = await handler({ queryStringParameters: {} })
    expect(res.statusCode).toBe(500)
    expect(res.body).toMatch(/boom/)
  })
})

describe('the feed URL', () => {
  it('uses site.web.api on the men’s 2027 window', async () => {
    await handler({ queryStringParameters: {} })
    const url = global.fetch.mock.calls[0][0]
    expect(url).toContain('site.web.api.espn.com')
    expect(url).toContain('basketball/fiba')
    expect(url).toContain('dates=20270827-20270912')
  })
})
