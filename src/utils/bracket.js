// Knockout bracket layout. FIBA's game numbering is not in bracket order, so each
// round is ordered explicitly here: the boxes that feed a later box sit next to
// each other vertically, producing a readable two-sided bracket that meets at the
// Final.

import { FLAG_BY_TEAM } from '../data/teams.js'
import { GAMES } from '../data/games.js'
import {
  ENTRY_ROUND,
  FEED_LABEL,
  WINNER_GAME,
  groupFedGames,
  groupPlacing,
  slotLabels,
} from './slots.js'

// A still-unresolved feed slot ("Winner Game 89" / "Loser Game 89") expands to the
// two teams of the game it feeds from, ONCE that game has both real teams: the
// "potential matchup". Returns { a, b, kind, num } or null for a real team, a
// non-feed label, or a source game that is not yet resolved. `byNum` maps game
// number → (resolved) game.
export function feederTeams(label, byNum) {
  const hit = FEED_LABEL.exec(label)
  if (!hit || !byNum) return null
  const fg = byNum[Number(hit[2])]
  if (!fg || !FLAG_BY_TEAM[fg.t1] || !FLAG_BY_TEAM[fg.t2]) return null
  return { a: fg.t1, b: fg.t2, kind: hit[1], num: fg.num }
}

// THE WIRING, from FIBA's published knockout bracket:
//
//   QF  85: 1st I - 2nd L      86: 1st L - 2nd I
//       87: 1st J - 2nd K      88: 1st K - 2nd J
//   SF  89: W85 - W87          90: W86 - W88
//   3rd 91: L89 - L90          Final 92: W89 - W90
//
// THE SECOND-ROUND GROUPS CROSS I<->L AND J<->K. A group's winner and runner-up
// are placed so they can only meet again in the Final: 1st I is in game 85 (left
// half) and 2nd I in game 86 (right half). Do not "tidy" the crossover into
// I-vs-J / K-vs-L; that would let two teams from the same second-round group meet
// in a semi-final.
//
// Unlike the women's edition, there is no bye: all eight quarter-finalists arrive
// from the second-round groups, so the bracket is a balanced 4-4 and every QF box
// has two feeding group slots.
//
// SOURCE AND STATUS: this is the wiring FIBA used in 2023 (verified against that
// tournament's results: Germany [1st I] met Latvia [2nd L], Canada [1st L] met
// Slovenia [2nd I], and so on). FIBA has not yet published the 2027 bracket, so
// this is the working default and must be re-checked when the 2027 sheet appears.
//
// Like the World Cup and unlike the Euro, a third-place game is played (91). It
// hangs off the bracket rather than sitting in it, so it gets its own key, and it
// is the only place the "Loser Game N" feed form appears.
export const BRACKET = {
  left: {
    QF: [85, 87],
    SF: [89],
  },
  final: [92],
  right: {
    QF: [86, 88],
    SF: [90],
  },
  third: [91],
}

export function gamesByNum(games) {
  return games.reduce((acc, g) => {
    acc[g.num] = g
    return acc
  }, {})
}

// Map each second-round group letter to the quarter-finals its 1st and 2nd place
// feed into, parsed from the placeholder labels. Both placings enter at the same
// round (the quarter-finals), which is the whole point of there being no bye.
//
//   { I: { win: 85, second: 86 }, ... }
export function groupSlotMap(games) {
  const map = {}
  const slot = (g) => (map[g] ||= { win: null, second: null })
  const key = { 1: 'win', 2: 'second' }
  for (const g of groupFedGames(games)) {
    for (const side of slotLabels(g)) {
      const hit = groupPlacing(side)
      /* v8 ignore next -- unreachable: every quarter-final slot side is a second-round group placing */
      if (hit) slot(hit.group)[key[hit.place]] = g.num
    }
  }
  return map
}

// Static winner-advancement edges: game number → the game its WINNER feeds into.
// Parsed once from the original "Winner Game N" labels. The Final has no parent,
// and neither does the third-place game: its winner advances nowhere, and it is
// fed by "Loser Game N".
const KO_WINNER_PARENT = (() => {
  const parent = {}
  for (const g of GAMES) {
    for (const side of slotLabels(g)) {
      const hit = WINNER_GAME.exec(side)
      if (hit) parent[Number(hit[1])] = g.num
    }
  }
  return parent
})()

// Winner of a FINISHED game; null while it is live, voided or unplayed.
//
// Basketball has no draw: overtime is played until a team wins, so a completed
// game always yields a winner and there is no shootout branch to consider. A level
// score on a completed record is a data error, not a draw, and returns null rather
// than inventing a winner. A local mirror of decideGame's rule, kept here to avoid
// dragging the whole resolver into this widely imported module.
function koWinner(g) {
  if (!g || !Array.isArray(g.score) || g.live || g.voided) return null
  const [a, b] = g.score
  if (a > b) return g.t1
  if (b > a) return g.t2
  return null
}

// Real teams that have reached the knockout: a quarter-final slot filled with an
// actual team, sorted. The candidates for a "path to the Final" trace.
export function knockoutTeams(byNum) {
  const set = new Set()
  for (const g of groupFedGames(Object.values(byNum))) {
    for (const t of [g.t1, g.t2]) if (FLAG_BY_TEAM[t]) set.add(t)
  }
  return [...set].sort()
}

// Trace one team's route through the knockout, inward to the Final. The route is
// structural (fixed by the bracket topology), so it exists whether the team is
// still alive or already out. Returns:
//   nums    — the full route, QF → Final (game numbers, outer to inner)
//   here    — the route games the team is actually a participant in
//   exitNum — the game where the team was knocked out, or null (alive/champion)
//   active  — the stretch of the route to highlight: the whole route while the
//             team is alive, or only through its exit once eliminated
//   entry   — the round the team joined at, always 'QF' in this format
//
// Returns null when the team has not reached the knockout. The third-place game is
// deliberately not part of a route: it is a consolation branch off the semi-final,
// not a step toward the trophy.
export function pathToFinal(team, byNum) {
  if (!team) return null
  const entryGame = Object.values(byNum)
    .filter((g) => g.stage === ENTRY_ROUND && (g.t1 === team || g.t2 === team))
    .sort((a, b) => a.num - b.num)[0]
  if (!entryGame) return null

  const nums = []
  for (let cur = entryGame.num; cur != null; cur = KO_WINNER_PARENT[cur]) nums.push(cur)
  const here = nums.filter((n) => {
    const g = byNum[n]
    return g && (g.t1 === team || g.t2 === team)
  })
  let exitNum = null
  for (const n of here) {
    const w = koWinner(byNum[n])
    if (w && w !== team) { exitNum = n; break }
  }
  const active = exitNum == null ? nums : nums.slice(0, nums.indexOf(exitNum) + 1)
  return { team, nums, here, exitNum, active, entry: entryGame.stage }
}
