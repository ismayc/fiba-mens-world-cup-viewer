// The small pure utilities: time, venue fallback, records, notifications, week
// bucketing, search, URL state and the calendar file.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  dayKey,
  detectTimezone,
  formatDateLong,
  formatDayKeyLong,
  formatTime,
  gameDayKey,
  gameStatus,
  liveState,
  statusFlag,
  teamKickoffTooltip,
  teamLocalKickoffs,
  timezoneOptions,
  tzAbbrev,
} from '../src/utils/time.js'
import { TBC_VENUE, venueFor } from '../src/utils/venue.js'
import { activeTeams, overtimeGames, teamRecord, tournamentTotals } from '../src/utils/tournamentStats.js'
import {
  detectFinals,
  finalNotification,
  mergeToasts,
  inScope,
  isFinal,
  isLiveish,
} from '../src/services/scoreNotify.js'
import { addDays, weekLabel, weekStartOf, weekdayHeader } from '../src/utils/week.js'
import { matchesSearch, parseQuery } from '../src/utils/search.js'
import { DEFAULT_FILTERS, readState, writeState } from '../src/utils/urlState.js'
import {
  buildICS,
  buildICSCollection,
  downloadICS,
  downloadICSCollection,
  googleCalendarUrl,
  webcalUrl,
} from '../src/utils/ics.js'
import { TEAM_TIMEZONES } from '../src/data/teamTimezones.js'
import { LEAGUE } from '../src/config/league.js'
import { withGroupScores } from './helpers/tournament.js'

const num = (n) => GAMES.find((g) => g.num === n)
const G1 = num(1) // United States v Nigeria, 2027-08-27 14:00 +03:00, Lusail
// A synthetic time-to-be-confirmed game, for the branches the men's board (which
// has a tip on every game) does not exercise on its own.
const TBC = { ...num(85), ko: null, tbdTip: true, date: '2027-09-08' }

describe('time', () => {
  it('formats a tip-off into any timezone', () => {
    expect(formatTime(G1.ko, 'Asia/Qatar')).toBe('2:00 PM')
    expect(formatTime(G1.ko, 'UTC')).toBe('11:00 AM')
    expect(formatTime(G1.ko, 'America/New_York')).toBe('7:00 AM')
  })

  it('names the day and the zone', () => {
    expect(formatDateLong(G1.ko, 'Asia/Qatar')).toContain('August 27, 2027')
    expect(dayKey(G1.ko, 'Asia/Qatar')).toBe('2027-08-27')
    expect(tzAbbrev(G1.ko, 'UTC')).toBeTruthy()
  })

  it('buckets a TBC game on its committed date, not the epoch', () => {
    expect(TBC.ko).toBeNull()
    expect(gameDayKey(TBC, 'UTC')).toBe('2027-09-08')
    expect(gameDayKey(TBC, 'UTC')).not.toBe('1970-01-01')
    expect(gameDayKey(G1, 'Asia/Qatar')).toBe('2027-08-27')
    // A game with neither a tip-off nor a committed date has no day at all.
    expect(gameDayKey({ ko: null, date: null }, 'UTC')).toBeNull()
  })

  it('names a calendar day from its key, with or without the year', () => {
    const long = formatDayKeyLong('2027-09-08')
    expect(long).toContain('September 8, 2027')
    expect(long).toMatch(/^[A-Z][a-z]+,/) // opens with a weekday
    expect(formatDayKeyLong('2027-09-08', { year: false })).toContain('September 8')
    expect(formatDayKeyLong('2027-09-08', { year: false })).not.toContain('2027')
    expect(formatDayKeyLong(null)).toBe('')
  })

  it('renders nothing at all for a missing tip-off', () => {
    for (const tz of ['UTC', 'America/Los_Angeles']) {
      expect(formatTime(null, tz)).toBe('')
      expect(formatDateLong(null, tz)).toBe('')
      expect(tzAbbrev(null, tz)).toBe('')
      expect(formatDateLong(undefined, tz)).toBe('')
      expect(formatTime('', tz)).toBe('')
    }
  })

  it('reports status from the clock when there is no feed data', () => {
    const before = new Date(G1.ko).getTime() - 60_000
    const during = new Date(G1.ko).getTime() + 30 * 60_000
    const after = new Date(G1.ko).getTime() + 5 * 3600_000
    expect(gameStatus(G1.ko, before)).toBe('upcoming')
    expect(gameStatus(G1.ko, during)).toBe('live')
    expect(gameStatus(G1.ko, after)).toBe('finished')
    expect(gameStatus(null)).toBe('upcoming')
  })

  it('prefers real feed data over the clock', () => {
    const during = new Date(G1.ko).getTime() + 30 * 60_000
    expect(liveState({ ...G1, live: {} }, during)).toBe('live')
    expect(liveState({ ...G1, score: [80, 70] }, during)).toBe('finished')
    expect(liveState({ ...G1, voided: true }, during)).toBe('voided')
    expect(liveState(G1, during)).toBe('live')
  })

  it('flags one-off statuses for display', () => {
    expect(statusFlag(G1)).toBeNull()
    expect(statusFlag({ ...G1, voided: true, statusLabel: 'Postponed' })).toEqual({
      kind: 'voided',
      label: 'Postponed',
    })
    expect(statusFlag({ ...G1, voided: true }).label).toBe('Off')
    expect(statusFlag({ ...G1, live: { delayed: true } }).kind).toBe('paused')
    expect(statusFlag({ ...G1, live: { delayed: true, label: 'Suspended' } }).label).toBe('Suspended')
    expect(statusFlag({ ...G1, awarded: true }).kind).toBe('awarded')
  })

  it('shows a tip-off in each competing nation’s own clock', () => {
    expect(teamLocalKickoffs(G1.ko, 'Nigeria')).toHaveLength(1)
    expect(teamKickoffTooltip(G1.ko, 'Nigeria')).toMatch(/^Tip-off in Nigeria:/)
    // The United States spans four zones, so it yields several distinct lines.
    expect(teamLocalKickoffs(G1.ko, 'United States').length).toBeGreaterThan(1)
    expect(teamKickoffTooltip(G1.ko, 'United States')).toMatch(/local times/)
    // Australia lists four zones, but Sydney and Brisbane read the same clock in
    // August (no DST), so they collapse to one line: fewer than four.
    const aus = teamLocalKickoffs(G1.ko, 'Australia')
    expect(aus.length).toBeGreaterThan(1)
    expect(aus.length).toBeLessThan(4)
  })

  it('says nothing for a bracket placeholder, a zone-less team or a game with no time', () => {
    expect(teamLocalKickoffs(G1.ko, 'Winner Group I')).toEqual([])
    expect(teamKickoffTooltip(G1.ko, 'Winner Group I')).toBe('')
    // A name with no home-zone entry has no local clock rather than crashing.
    expect(teamLocalKickoffs(G1.ko, 'Atlantis')).toEqual([])
    expect(teamLocalKickoffs(null, 'United States')).toEqual([])
  })

  it('offers UTC, the detected zone and a home zone per known nation', () => {
    expect(typeof detectTimezone()).toBe('string')
    const opts = timezoneOptions('Pacific/Auckland')
    expect(opts).toContain('UTC')
    expect(opts).toContain('Pacific/Auckland') // the viewer's own, even if exotic
    expect(new Set(opts).size).toBe(opts.length) // deduped
    for (const tz of Object.values(TEAM_TIMEZONES)) expect(opts).toContain(tz[0])
  })

  it('falls back to UTC when the platform throws or reports no zone name', () => {
    const orig = Intl.DateTimeFormat
    Intl.DateTimeFormat = () => {
      throw new Error('no Intl')
    }
    try {
      expect(detectTimezone()).toBe('UTC')
    } finally {
      Intl.DateTimeFormat = orig
    }
    // resolvedOptions present but with an empty zone name.
    Intl.DateTimeFormat = function () {
      return { resolvedOptions: () => ({ timeZone: '' }) }
    }
    try {
      expect(detectTimezone()).toBe('UTC')
    } finally {
      Intl.DateTimeFormat = orig
    }
  })
})

describe('venue fallback', () => {
  it('resolves a real arena', () => {
    expect(venueFor(G1).name).toBe('Lusail Sports Arena')
  })

  it('falls back to a Doha placeholder rather than crashing', () => {
    const v = venueFor({ venue: undefined })
    expect(v).toBe(TBC_VENUE)
    expect(v.city).toBe(LEAGUE.host.city)
    expect(v.tz).toBe('Asia/Qatar')
    expect(v.tbc).toBe(true)
    expect(venueFor(undefined)).toBe(TBC_VENUE)
  })
})

describe('team records', () => {
  const played = withGroupScores(
    'A',
    [
      ['United States', 'Nigeria', 90, 60], // 27 Aug, US win by 30
      ['United States', 'Dominican Republic', 70, 75], // 29 Aug, US loss
      ['Greece', 'United States', 70, 80], // 31 Aug, US win
    ],
    GAMES,
  )

  it('counts W–L with no draw column', () => {
    const r = teamRecord(played, 'United States')
    expect(r).not.toHaveProperty('d')
    expect(r.w).toBe(2)
    expect(r.l).toBe(1)
    expect(r.played).toBe(3)
    expect(r.pf).toBe(240)
    expect(r.pd).toBe(240 - 205)
  })

  it('tracks overtime games instead of shootouts', () => {
    const ot = played.map((g) => (g.num === 1 ? { ...g, ot: 1 } : g))
    expect(teamRecord(ot, 'United States').otWins).toBe(1)
    expect(teamRecord(ot, 'Nigeria').otLosses).toBe(1)
    expect(overtimeGames(ot)).toHaveLength(1)
  })

  it('reports the biggest win and a non-empty current run', () => {
    const r = teamRecord(played, 'United States')
    expect(r.biggestWin).toMatchObject({ margin: 30, opponent: 'Nigeria' })
    expect([1, -1, 2]).toContain(r.streak)
  })

  it('counts a run of consecutive wins and of consecutive losses', () => {
    const g = (n, s, ko) => ({ num: n, stage: 'R1', t1: 'X', t2: `Y${n}`, score: s, ko })
    // Chronological wins then losses; streak reads most-recent-first, so -2.
    expect(
      teamRecord(
        [
          g(1, [80, 70], '2027-08-27T14:00:00+03:00'),
          g(2, [80, 70], '2027-08-28T14:00:00+03:00'),
          g(3, [70, 80], '2027-08-29T14:00:00+03:00'),
          g(4, [70, 80], '2027-08-30T14:00:00+03:00'),
        ],
        'X',
      ).streak,
    ).toBe(-2)
    // Losses then wins: streak +2.
    expect(
      teamRecord(
        [
          g(1, [70, 80], '2027-08-27T14:00:00+03:00'),
          g(2, [70, 80], '2027-08-28T14:00:00+03:00'),
          g(3, [80, 70], '2027-08-29T14:00:00+03:00'),
          g(4, [80, 70], '2027-08-30T14:00:00+03:00'),
        ],
        'X',
      ).streak,
    ).toBe(2)
  })

  it('limits the record to games that tipped off earlier', () => {
    const r = teamRecord(played, 'United States', { before: '2027-08-28T00:00:00+03:00' })
    expect(r.played).toBe(1) // only the 27 August game
    expect(r.w).toBe(1)
  })

  it('ignores a level score rather than counting it as a draw', () => {
    const bad = withGroupScores('A', [['United States', 'Nigeria', 70, 70]], GAMES)
    expect(teamRecord(bad, 'United States').played).toBe(0)
  })

  it('lists the teams still involved, ignoring voided games', () => {
    expect(activeTeams(GAMES).size).toBe(32)
    expect(activeTeams(GAMES).has('Winner Group I')).toBe(false)
    // A voided fixture is not an active one.
    expect(activeTeams([{ stage: 'R1', t1: 'United States', t2: 'Nigeria', voided: true }]).size).toBe(0)
  })

  it('orders multiple overtime games and reads the opponent from either side', () => {
    const board = [
      { num: 1, stage: 'R1', t1: 'A', t2: 'X', score: [60, 90], ot: 1, ko: '2027-08-28T14:00:00+03:00' }, // X (t2) wins +30 in OT
      { num: 2, stage: 'R1', t1: 'X', t2: 'B', score: [70, 68], ot: 2, ko: '2027-08-27T14:00:00+03:00' }, // X (t1) wins +2 in 2OT
    ]
    const ot = overtimeGames(board)
    expect(ot).toHaveLength(2)
    expect(ot[0].num).toBe(2) // ordered by tip: 27 August before 28 August
    const r = teamRecord(board, 'X')
    expect(r.otWins).toBe(2)
    // X was the second-named side in its biggest win, so the opponent is t1.
    expect(r.biggestWin).toMatchObject({ margin: 30, opponent: 'A' })
    // Both games went to overtime, so the tournament total counts two.
    expect(tournamentTotals(board).ot).toBe(2)
  })

  it('takes the largest margin even when it comes in a later game', () => {
    const board = [
      { num: 1, stage: 'R1', t1: 'X', t2: 'A', score: [80, 75], ko: '2027-08-27T14:00:00+03:00' }, // +5
      { num: 2, stage: 'R1', t1: 'X', t2: 'B', score: [90, 60], ko: '2027-08-28T14:00:00+03:00' }, // +30, later
      { num: 3, stage: 'R1', t1: 'X', t2: 'C', score: [50, 49], ko: '2027-08-29T14:00:00+03:00', voided: true },
    ]
    expect(teamRecord(board, 'X').biggestWin.margin).toBe(30)
    expect(tournamentTotals(board).biggest.margin).toBe(30)
  })

  it('totals the tournament so far', () => {
    const t = tournamentTotals(played)
    expect(t.played).toBe(3)
    expect(t.points).toBe(445)
    expect(t.perGame).toBeCloseTo(445 / 3)
    expect(t.biggest.margin).toBe(30)
    expect(tournamentTotals(GAMES)).toMatchObject({ played: 0, perGame: 0, biggest: null })
    expect(tournamentTotals([{ live: {} }]).live).toBe(1)
  })
})

describe('result notifications', () => {
  const finalGame = { num: 1, t1: 'United States', t2: 'Nigeria', score: [88, 61], liveSource: true }

  it('recognizes a finished, live-ish, in-scope game', () => {
    expect(isFinal(finalGame)).toBe(true)
    expect(isFinal({ ...finalGame, live: {} })).toBe(false)
    expect(isFinal({ ...finalGame, voided: true })).toBe(false)
    expect(isLiveish(finalGame)).toBe(true)
    expect(isLiveish({ num: 1 })).toBe(false)
    expect(inScope(finalGame, 'all')).toBe(true)
    expect(inScope(finalGame, 'followed', new Set(['United States']))).toBe(true)
    expect(inScope(finalGame, 'followed', new Set(['Spain']))).toBe(false)
    expect(inScope(finalGame, 'followed', null)).toBe(false)
  })

  it('records a game seen for the first time without notifying', () => {
    const { next, events } = detectFinals(null, [finalGame], { scope: 'all' })
    expect(events).toHaveLength(0)
    expect(next.get(1)).toBe(true)
  })

  it('notifies when a game newly goes final', () => {
    const before = detectFinals(null, [{ ...finalGame, score: undefined, live: {} }], { scope: 'all' })
    const { events } = detectFinals(before.next, [finalGame], { scope: 'all' })
    expect(events).toHaveLength(1)
    expect(events[0].game.num).toBe(1)
  })

  it('never re-fires a result it has already reported', () => {
    const first = detectFinals(null, [{ ...finalGame, score: undefined, live: {} }], { scope: 'all' })
    const second = detectFinals(first.next, [finalGame], { scope: 'all' })
    const dropped = detectFinals(second.next, [{ ...finalGame, score: undefined }], { scope: 'all' })
    const restored = detectFinals(dropped.next, [finalGame], { scope: 'all' })
    expect(restored.events).toHaveLength(0)
  })

  it('stays silent for a committed score that was never live', () => {
    const committed = { num: 1, t1: 'United States', t2: 'Nigeria', score: [88, 61] }
    const first = detectFinals(null, [{ ...committed, score: undefined }], { scope: 'all' })
    expect(detectFinals(first.next, [committed], { scope: 'all' }).events).toHaveLength(0)
  })

  it('formats a result notification, noting overtime', () => {
    expect(finalNotification({ game: finalGame })).toMatchObject({
      title: '🏀 FINAL: United States win',
      body: 'United States 88–61 Nigeria',
      tag: 'final|1',
    })
    expect(finalNotification({ game: { ...finalGame, ot: 1 } }).title).toContain('(OT)')
    expect(finalNotification({ game: { ...finalGame, ot: 2 } }).title).toContain('(2OT)')
    expect(finalNotification({ game: { ...finalGame, score: [61, 88] } }).title).toContain('Nigeria')
  })

  it('appends a new result to the toast list', () => {
    const merged = mergeToasts([], [{ game: finalGame }])
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('final|1')
    expect(merged[0].ev.game.t1).toBe('United States')
  })

  it('keeps toasts already on screen when a different game ends', () => {
    const other = { num: 2, t1: 'Brazil', t2: 'Georgia', score: [70, 65] }
    const merged = mergeToasts(mergeToasts([], [{ game: finalGame }]), [{ game: other }])
    expect(merged.map((x) => x.id)).toEqual(['final|1', 'final|2'])
  })

  it('returns the same array when every event is already showing', () => {
    const first = mergeToasts([], [{ game: finalGame }])
    expect(mergeToasts(first, [{ game: finalGame }])).toBe(first)
    expect(mergeToasts(first, [])).toBe(first)
  })
})

describe('week bucketing', () => {
  it('walks days and weeks', () => {
    expect(addDays('2027-08-27', 1)).toBe('2027-08-28')
    expect(addDays('2027-08-27', -1)).toBe('2027-08-26')
    const start = weekStartOf('2027-08-27')
    expect(new Date(`${start}T12:00:00`).getDay()).toBe(0) // a Sunday
    expect(start <= '2027-08-27').toBe(true)
    expect(weekLabel(start)).toBeTruthy()
    expect(weekdayHeader('2027-08-27')).toBeTruthy()
  })
})

describe('search', () => {
  const venue = venueFor(G1)

  it('matches plain text against teams and venues', () => {
    expect(matchesSearch(G1, venue, parseQuery('nigeria'))).toBe(true)
    expect(matchesSearch(G1, venue, parseQuery('lusail'))).toBe(true)
    expect(matchesSearch(G1, venue, parseQuery('australia'))).toBe(false)
  })

  it('supports field-scoped terms', () => {
    expect(matchesSearch(G1, venue, parseQuery('team: United States'))).toBe(true)
    expect(matchesSearch(G1, venue, parseQuery('team: Spain'))).toBe(false)
    expect(matchesSearch(G1, venue, parseQuery('stage: first round'))).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(matchesSearch(G1, venue, parseQuery(''))).toBe(true)
  })

  it('tolerates a venue with no sponsor name', () => {
    const noSponsor = { ...venue, sponsorName: null }
    // Arena term that misses the name forces the sponsorName branch to evaluate.
    expect(matchesSearch(G1, noSponsor, parseQuery('arena: zzz'))).toBe(false)
    // Free text still searches the (empty) sponsor slot without throwing.
    expect(matchesSearch(G1, noSponsor, parseQuery('lusail'))).toBe(true)
  })
})

describe('URL state', () => {
  it('round-trips view, timezone, spoilers and filters', () => {
    const state = {
      view: 'bracket',
      tz: 'Asia/Qatar',
      hideScores: true,
      filters: { ...DEFAULT_FILTERS, group: 'A', team: 'United States', myTeams: true, search: 'x' },
    }
    writeState(state, 'UTC')
    const read = readState('UTC')
    expect(read.view).toBe('bracket')
    expect(read.tz).toBe('Asia/Qatar')
    expect(read.hideScores).toBe(true)
    expect(read.filters).toEqual(state.filters)
  })

  it('writes nothing for defaults', () => {
    writeState({ view: 'schedule', tz: 'UTC', hideScores: false, filters: DEFAULT_FILTERS }, 'UTC')
    expect(window.location.search).toBe('')
    expect(readState('UTC').view).toBe('schedule')
  })

  it('round-trips the stage, venue, timeframe and service filters', () => {
    const state = {
      view: 'week',
      tz: 'UTC',
      hideScores: false,
      filters: {
        ...DEFAULT_FILTERS,
        stages: ['R1', 'QF'],
        venue: 'lusail',
        timeframe: 'today',
        onMyServices: true,
      },
    }
    writeState(state, 'UTC')
    const read = readState('UTC')
    expect(read.filters.stages).toEqual(['R1', 'QF'])
    expect(read.filters.venue).toBe('lusail')
    expect(read.filters.timeframe).toBe('today')
    expect(read.filters.onMyServices).toBe(true)
  })

  it('has no broadcast-language filter', () => {
    expect(DEFAULT_FILTERS).not.toHaveProperty('feed')
  })
})

describe('calendar files', () => {
  it('exports a game with no confirmed tip as an all-day event on its date', () => {
    const ics = buildICS(TBC)
    expect(ics).toContain('DTSTART;VALUE=DATE:20270908')
    expect(ics).toContain('DTEND;VALUE=DATE:20270909')
    expect(ics).not.toMatch(/19700101|19691231/)
    // Slot labels stand in for the teams the draw has not named yet.
    expect(ics).toContain('SUMMARY:FIBA MWC: Winner Group I vs 2nd Group L')
    expect(ics).not.toContain('null')
  })

  it('keeps a confirmed tip a timed event', () => {
    const ics = buildICS(G1)
    expect(ics).toContain('DTSTART:20270827T110000Z')
    expect(ics).not.toContain('VALUE=DATE')
  })

  it('leaves the TV line out of a collection entry with no platform', () => {
    const ics = buildICSCollection([{ ...num(1), tv: [], tvNote: null }])
    expect(ics).not.toContain('US TV:')
    expect(ics).toContain('SUMMARY:FIBA MWC: United States vs Nigeria')
  })

  it('exports every game of the tournament, including unresolved ones', () => {
    const ics = buildICSCollection(GAMES)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(GAMES.length)
    expect(ics).not.toMatch(/19700101|19691231/)
    expect(ics).not.toContain('null')
  })

  it('builds a single-game .ics naming the tournament, not a sibling', () => {
    const ics = buildICS(G1)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:FIBA MWC: United States vs Nigeria')
    expect(ics).toContain('Lusail Sports Arena')
    expect(ics).toContain('Game 1')
    expect(ics).not.toContain('EURO')
    expect(ics).not.toContain('WWC')
    expect(ics).toContain("PRODID:-//FIBA Men's World Cup 2027 Viewer//EN")
    expect(ics).toContain('UID:fibamwc2027-game-1@')
  })

  it('builds a whole first-round collection', () => {
    const ics = buildICSCollection(GAMES.filter((g) => g.stage === 'R1'))
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(48)
  })

  it('turns a feed URL into subscription links', () => {
    expect(webcalUrl('https://x.test/feed.ics')).toBe('webcal://x.test/feed.ics')
    expect(googleCalendarUrl('https://x.test/feed.ics')).toContain('cid=webcal://')
  })

  // A group-stage record, a US-TV line, a round note and a played score exercise
  // the branches the placeholder board (labelled non-R1 games, empty tv, no
  // scores) does not reach on its own.
  it('writes the group label, TV lines, round notes and scores', () => {
    const grp = { ...G1, stage: 'Group', group: 'A', tv: ['DAZN', 'HBO Max'], tvNote: 'Also on TNT' }
    const single = buildICS(grp)
    expect(single).toContain('Group A · Game 1')
    expect(single).toContain('US TV: DAZN / HBO Max')
    expect(single).toContain('Also on TNT')
    const coll = buildICSCollection([{ ...grp, score: [80, 70] }])
    expect(coll).toContain('Group A')
    expect(coll).toContain('(80–70)')
    expect(coll).toContain('US TV: DAZN / HBO Max')
    expect(coll).toContain('Also on TNT')
  })

  it('offers a single game and a whole collection as downloads', () => {
    const clicks = []
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    const origClick = HTMLAnchorElement.prototype.click
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => {}
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this.download)
    }
    try {
      downloadICS(G1)
      downloadICSCollection([G1])
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
      HTMLAnchorElement.prototype.click = origClick
    }
    expect(clicks[0]).toBe('fiba-mens-world-cup-2027-game-1.ics')
    expect(clicks[1]).toBe('fiba-mens-world-cup-2027.ics')
  })
})
