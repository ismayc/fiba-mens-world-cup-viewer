// "As it stands": project each stage forward from the CURRENT standings, so the
// standings tables can show where a group's top two would land right now.
//
// The men's structure projects in two hops:
//
//   • A FIRST-ROUND group's top two advance to a specific second-round group
//     (A & B -> I, and so on). Their exact second-round opponents are not a single
//     game (each plays both qualifiers from the paired group), so the projection
//     just names the second-round group they are heading for.
//
//   • A SECOND-ROUND group's top two advance to a quarter-final, where the
//     opponent IS a single slot: the other second-round group's placing on the
//     I<->L / J<->K crossover. That opponent is named from the live second-round
//     table when it exists, or left as a pending slot label otherwise.
//
// This is a direct lookup into the live standings; no cross-group race exists.

import { GAMES } from '../data/games.js'
import {
  FIRST_ROUND_GROUPS,
  SECOND_ROUND_GROUPS,
  R2_MEMBERSHIP,
  computeQualification,
} from './qualification.js'
import { computeSecondRound } from './secondRound.js'
import { groupSlotMap } from './bracket.js'
import { groupFedGames, groupPlacing, slotLabels } from './slots.js'

// First-round group -> the second-round group it feeds (A -> I, B -> I, ...).
const R2_OF = (() => {
  const m = {}
  for (const [r2, pair] of Object.entries(R2_MEMBERSHIP)) for (const g of pair) m[g] = r2
  return m
})()

// Static quarter-final slot labels by game number: the live feed resolves some to
// real teams, so always read the invariant labels from the committed schedule.
const QF_SLOTS = new Map(groupFedGames(GAMES).map((g) => [g.num, slotLabels(g)]))

// Returns { r1, r2 }:
//   r1[group] = { first, second } where each is { team, r2group } | null
//   r2[key]   = { first, second } | null (null until the group is seeded), where
//               each is { team, gameNum, round:'QF', opponent, opponentLabel }
export function projectKnockout(games) {
  const qual = computeQualification(games)
  const sr = computeSecondRound(games)

  const r1 = {}
  for (const g of FIRST_ROUND_GROUPS) {
    const rows = qual.groups[g]
    /* v8 ignore next -- unreachable: rankGroup always returns four ordered rows, so rows[0]/rows[1] are always present */
    const at = (i) => (rows[i] ? { team: rows[i].name, r2group: R2_OF[g] } : null)
    r1[g] = { first: at(0), second: at(1) }
  }

  const slotMap = groupSlotMap(GAMES)
  const r2 = {}
  for (const key of SECOND_ROUND_GROUPS) {
    const rows = sr.groups[key]
    if (!rows) {
      r2[key] = null
      continue
    }
    const project = (row, place) => {
      /* v8 ignore next -- unreachable: project is only called with rows[0]/rows[1], which rankGroup always provides */
      if (!row) return null
      const gameNum = place === 1 ? slotMap[key].win : slotMap[key].second
      const [l1, l2] = QF_SLOTS.get(gameNum)
      const mineIsFirst = (() => {
        const p = groupPlacing(l1)
        return p && p.group === key && p.place === place
      })()
      const oppLabel = mineIsFirst ? l2 : l1
      const op = groupPlacing(oppLabel)
      /* v8 ignore next -- unreachable: a quarter-final's paired slot is always a second-round group placing */
      const oppRows = op ? sr.groups[op.group] : null
      // oppRows is null when the crossover group is not yet seeded; when it is, it
      // has four rows so place 1/2 always exists.
      const opponent = oppRows ? oppRows[op.place - 1].name : null
      return {
        team: row.name,
        gameNum,
        round: 'QF',
        opponent,
        opponentLabel: opponent ? null : oppLabel,
      }
    }
    r2[key] = { first: project(rows[0], 1), second: project(rows[1], 2) }
  }

  return { r1, r2 }
}
