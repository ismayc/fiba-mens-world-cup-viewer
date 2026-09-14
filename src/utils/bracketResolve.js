// Resolve placeholder slots into real teams as the tournament progresses, in
// dependency order across the men's two-stage-plus-knockout structure:
//
//   1. Second-round games ("Winner Group A" / "2nd Group B") fill from the
//      FIRST-round group tables, once the feeding first-round group is complete.
//   2. Quarter-finals ("Winner Group I" / "2nd Group L") fill from the
//      SECOND-round group tables, once the feeding second-round group is complete.
//   3. Semi-finals, the third-place game and the Final ("Winner Game 89" /
//      "Loser Game 89") fill from knockout results, propagating up the bracket.
//
// All resolution is conservative: a slot stays a placeholder until its outcome is
// genuinely settled, so the bracket never shows a team that could still change.
// The classification games (stage 'Class') are deliberately never resolved: this
// viewer ranks 1-16 only, so their feeder labels are shown as drawn.
//
// A game record keeps its labels in `label1`/`label2` permanently and carries
// `t1`/`t2` null until resolved: FIBA publishes the wiring long before the teams,
// so resolution FILLS the team fields rather than overwriting the labels.

import { TEAMS } from '../data/teams.js'
import {
  FIRST_ROUND_GROUPS,
  rankGroup,
  groupComplete,
} from './qualification.js'
import { rankSecondRound, secondRoundComplete } from './secondRound.js'
import { WINNER_GAME, LOSER_GAME, groupPlacing } from './slots.js'

const ALL_TEAMS = new Set(Object.values(TEAMS).flat().map((t) => t.name))

// A result counts only once FINAL: a live score is provisional, a voided game has
// no result.
const isFinal = (g) => g.score && !g.live && !g.voided

// Winner / loser of a finished knockout game. Basketball has no draw: overtime is
// played until a team wins and `score` holds the final total, so a completed game
// ALWAYS has a winner. A level score on a completed record is a data error, not a
// draw, and returns null so the slot stays a placeholder rather than the bracket
// inventing a winner. No shootout / `pens` branch exists here.
export function decideGame(g) {
  if (!isFinal(g)) return null
  const [a, b] = g.score
  if (a > b) return { winner: g.t1, loser: g.t2 }
  if (b > a) return { winner: g.t2, loser: g.t1 }
  return null
}

// The real team in a group placing, or null while that group is undecided. `group`
// is a first-round letter (A-H) for a second-round game, or a second-round letter
// (I-L) for a quarter-final; the caller passes the matching lookup.
function placedTeam(group, place, games) {
  // A complete group has four ranked rows, so once the guard passes place 1/2
  // always resolves to a real team; no fallback is reachable past the guard.
  if (FIRST_ROUND_GROUPS.includes(group)) {
    if (!groupComplete(TEAMS[group], games)) return null
    return rankGroup(TEAMS[group], games)[place - 1].name
  }
  if (!secondRoundComplete(group, games)) return null
  return rankSecondRound(group, games)[place - 1].name
}

// Fill group-placing slots ("Winner Group X" / "2nd Group X") on the games at the
// given stages, from the current group tables. Used for the second round (fed by
// first-round groups) and the quarter-finals (fed by second-round groups).
export function resolvePlacingSlots(games, stages) {
  const set = new Set(stages)
  return games.map((g) => {
    if (!set.has(g.stage)) return g
    const side = (which) => {
      if (g[`t${which}`]) return g[`t${which}`]
      const p = groupPlacing(g[`label${which}`])
      return (p && placedTeam(p.group, p.place, games)) || g[`t${which}`]
    }
    const t1 = side(1)
    const t2 = side(2)
    return t1 === g.t1 && t2 === g.t2 ? g : { ...g, t1, t2 }
  })
}

// Fill "Winner Game N" / "Loser Game N" feed labels on the KNOCKOUT games (never
// the classification games, which also carry those labels but are not ranked),
// propagating up the bracket a round at a time. A slot resolves only when both of
// the source game's teams are already real, otherwise the loser's name is not
// known, so we wait. Bounded passes = bracket depth.
export function resolveKnockoutSlots(games) {
  const KO = new Set(['QF', 'SF', '3rd', 'Final'])
  const winner = {}
  const loser = {}
  const sub = (label) => {
    let h = WINNER_GAME.exec(label || '')
    if (h && winner[h[1]]) return winner[h[1]]
    h = LOSER_GAME.exec(label || '')
    if (h && loser[h[1]]) return loser[h[1]]
    return null
  }
  const sideOf = (g, which) => g[`t${which}`] ?? sub(g[`label${which}`])

  for (let pass = 0; pass < 8; pass++) {
    let changed = false
    for (const g of games) {
      if (!KO.has(g.stage) || winner[g.num] != null) continue
      const t1 = sideOf(g, 1)
      const t2 = sideOf(g, 2)
      if (!ALL_TEAMS.has(t1) || !ALL_TEAMS.has(t2)) continue
      const out = decideGame({ ...g, t1, t2 })
      if (out) {
        winner[g.num] = out.winner
        loser[g.num] = out.loser
        changed = true
      }
    }
    if (!changed) break
  }

  return games.map((g) => {
    if (!KO.has(g.stage)) return g
    const t1 = sideOf(g, 1)
    const t2 = sideOf(g, 2)
    return t1 === g.t1 && t2 === g.t2 ? g : { ...g, t1, t2 }
  })
}

// Full bracket resolution, in dependency order: second-round games filled from
// first-round tables, quarter-finals filled from second-round tables, then
// knockout winners and losers propagated up the rounds.
export function resolveBracket(games) {
  const withR2 = resolvePlacingSlots(games, ['R2'])
  const withQF = resolvePlacingSlots(withR2, ['QF'])
  return resolveKnockoutSlots(withQF)
}
