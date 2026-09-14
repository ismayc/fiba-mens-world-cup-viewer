// Shared fixture helpers.
//
// Every builder here starts from the FROZEN pre-tournament board in
// test/fixtures/pretournament-games.js, never from src/data/games.js. The
// committed board is regenerated during the tournament, so a builder based on it
// would quietly inherit real results.
//
// Two consequences worth knowing before writing a test here:
//
//   * `GAMES` here is the "nothing played yet" board (all 92 games).
//   * The knockout and second-round records carry `label1`/`label2` and null teams
//     from the start, so bracket code must be exercised through the resolver rather
//     than by handing it a board that already names teams.

import { vi } from 'vitest'
import { GAMES } from '../fixtures/pretournament-games.js'
import { TEAMS } from '../../src/data/teams.js'
import { RANK_BY_TEAM } from '../../src/data/teams.js'
import { resolveBracket } from '../../src/utils/bracketResolve.js'

export const groupTeams = (g) => TEAMS[g].map((t) => t.name)

// A fixed instant a few hours before the tournament's first tip-off (25 August
// 2023, earliest tip 16:00 in Manila / +08:00).
export const BEFORE_TIPOFF = new Date('2023-08-25T13:00:00+08:00')

// Pin the clock, for anything that asks "what is next", "has this tipped off" or
// "is this game live". Only Date is faked, so real timers and waitFor keep working.
export function pinClock(when = BEFORE_TIPOFF) {
  vi.useFakeTimers({ now: when, toFake: ['Date'] })
}

// Overlay scores on one first-round group's fixtures, matching by team pair so the
// caller states results the natural way round. `results` entries are
// [teamA, teamB, aPoints, bPoints].
export function withGroupScores(group, results, games = GAMES) {
  return games.map((g) => {
    if (g.stage !== 'R1' || g.group !== group) return g
    const r = results.find(
      ([a, b]) => (a === g.t1 && b === g.t2) || (a === g.t2 && b === g.t1),
    )
    if (!r) return g
    const [a, , ap, bp] = r
    return { ...g, score: a === g.t1 ? [ap, bp] : [bp, ap] }
  })
}

// A first-round group where every game is decided, cycling the winner through the
// given map (game number -> winning team name). Handy when a test cares about the
// STANDING, not the scoreline.
export function groupWithWinners(group, winners, games = GAMES) {
  return games.map((g) => {
    if (g.stage !== 'R1' || g.group !== group) return g
    const w = winners[g.num]
    if (!w) return g
    return { ...g, score: w === g.t1 ? [80, 70] : [70, 80] }
  })
}

// Decide every game of a stage. `pick(game)` returns the winning team name;
// default is the higher-ranked (lower RANK_BY_TEAM) side, giving deterministic,
// realistic tables. Games with unresolved sides (null teams) are left alone.
const byRankWinner = (g) =>
  RANK_BY_TEAM[g.t1] <= RANK_BY_TEAM[g.t2] ? g.t1 : g.t2

export function playStage(stage, games = GAMES, pick = byRankWinner) {
  return games.map((g) => {
    if (g.stage !== stage || !g.t1 || !g.t2) return g
    const w = pick(g)
    return { ...g, score: w === g.t1 ? [90, 70] : [70, 90] }
  })
}

// Decide every first-round group game. `pick(game)` returns the winner; defaults
// to the first side, which is deterministic but deliberately tie-heavy.
export function allGroupsPlayed(pick = (g) => g.t1, games = GAMES) {
  return games.map((g) => {
    if (g.stage !== 'R1') return g
    const w = pick(g)
    return { ...g, score: w === g.t1 ? [80, 70] : [70, 80] }
  })
}

// Play the whole tournament to a champion: first round, then resolve and play the
// second round, the quarter-finals, semis, then the final and third-place game.
// Returns the fully resolved board. `pick` decides every game.
export function playWholeTournament(games = GAMES, pick = byRankWinner) {
  let g = playStage('R1', games, pick)
  for (const stage of ['R2', 'QF', 'SF']) {
    g = resolveBracket(g)
    g = playStage(stage, g, pick)
  }
  return resolveBracket(g)
}

// Set the result of one knockout game, naming both sides explicitly: the resolver
// fills `t1`/`t2`, so a test that wants to force a result has to supply them too.
export function decideFinalPhase(games, num, t1, t2, score) {
  return games.map((g) => (g.num === num ? { ...g, t1, t2, score } : g))
}

const VENUE_ESPN_ID = { philippinearena: '10001', moa: '10002', araneta: '10003', okinawa: '10004', jakarta: '10005' }

// An ESPN scoreboard payload in the shape services/espn.js parses. `overrides`
// maps a game number to { state, score, period, statusName, clock, detail }.
export function espnScoreboard(games, overrides = {}) {
  return {
    events: games
      .filter((g) => g.espnId && g.ko && g.t1 && g.t2)
      .map((g) => {
        const o = overrides[g.num] || {}
        const state = o.state || (g.score ? 'post' : 'pre')
        const score = o.score || g.score
        return {
          id: g.espnId,
          date: new Date(g.ko).toISOString().replace('.000', ''),
          status: {
            period: o.period ?? (state === 'pre' ? 0 : 4),
            displayClock: o.clock ?? '0:00',
            type: {
              state,
              name: o.statusName || `STATUS_${state === 'post' ? 'FINAL' : state === 'in' ? 'IN_PROGRESS' : 'SCHEDULED'}`,
              completed: state === 'post',
              description: o.detail || (state === 'post' ? 'Final' : ''),
              shortDetail: o.detail || '',
            },
          },
          competitions: [
            {
              id: g.espnId,
              date: new Date(g.ko).toISOString().replace('.000', ''),
              neutralSite: true,
              venue: { id: VENUE_ESPN_ID[g.venue] || '10001', fullName: 'x' },
              competitors: [
                { homeAway: 'away', score: score ? String(score[0]) : '', team: { id: '1', displayName: g.t1 } },
                { homeAway: 'home', score: score ? String(score[1]) : '', team: { id: '2', displayName: g.t2 } },
              ],
            },
          ],
        }
      }),
  }
}
