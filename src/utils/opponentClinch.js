// Knockout opponent clinch detection.
//
// "Has team X clinched a specific quarter-final opponent?" is more than "has X
// reached the knockout": it asks whether the opponent is the SAME team in every
// remaining completion of the second round.
//
// In the men's format the answer is a two-group question at the SECOND-round
// level. A quarter-final slot is a second-round group placing (1st or 2nd), and
// the crossover pairs it with a placing of ANOTHER second-round group (I<->L,
// J<->K). So X's quarter-final opponent locks as soon as BOTH placings are pinned
// exactly: X's own finishing position in its second-round group, and the opposing
// group's team at the paired position. There is no bye and no
// winner-of-an-unplayed-game slot in the quarter-finals, so unlike the women's
// edition every quarter-final opponent CAN be clinched from the tables alone.

import { GAMES } from '../data/games.js'
import { SECOND_ROUND_GROUPS } from './qualification.js'
import { r2Members, rankSecondRound } from './secondRound.js'
import { groupPositionBoundsR2 } from './clinch.js'
import { groupSlotMap } from './bracket.js'
import { groupFedGames, groupPlacing, slotLabels } from './slots.js'

const QF_SLOTS = new Map(groupFedGames(GAMES).map((g) => [g.num, slotLabels(g)]))
const SLOT_MAP = groupSlotMap(GAMES) // { I: { win, second }, ... }

// The second-round group a team is in, or null if it is not (yet) a second-round
// team. `bounds` is groupPositionBoundsR2 for the current games.
function r2GroupOf(team, games) {
  for (const key of SECOND_ROUND_GROUPS) {
    const members = r2Members(key, games)
    if (members && members.some((t) => t.name === team)) return key
  }
  /* v8 ignore next -- unreachable via lockedOpponent: exactPlace already ensures the team is in a seeded second-round group */
  return null
}

// The exact finishing position (1-4) of a team in its second-round group, or null
// if it is not yet pinned.
function exactPlace(team, bounds) {
  const b = bounds[team]
  return b && b.best === b.worst ? b.best : null
}

// The locked quarter-final opponent for `team`, or null if it is not yet
// mathematically fixed. `boundsR2` may be passed in to avoid recomputing it.
export function lockedOpponent(games, team, boundsR2 = groupPositionBoundsR2(games)) {
  const place = exactPlace(team, boundsR2)
  // Only the top two reach the quarter-finals, and only a pinned placing gives a
  // determinate matchup.
  if (place == null || place > 2) return null
  const key = r2GroupOf(team, games)
  /* v8 ignore next -- unreachable: a team with an R2 position bound is in a seeded R2 group */
  if (!key) return null

  const gameNum = place === 1 ? SLOT_MAP[key].win : SLOT_MAP[key].second
  const [l1, l2] = QF_SLOTS.get(gameNum)
  const mineIsFirst = (() => {
    const p = groupPlacing(l1)
    return p && p.group === key && p.place === place
  })()
  const oppLabel = mineIsFirst ? l2 : l1
  const op = groupPlacing(oppLabel)
  /* v8 ignore next -- unreachable: the paired quarter-final slot is always another group placing in this format */
  if (!op) return null

  // The opposing team is locked only if its second-round placing is itself pinned.
  const oppRows = rankSecondRound(op.group, games)
  const oppTeam = oppRows?.[op.place - 1]?.name
  if (!oppTeam) return null
  if (exactPlace(oppTeam, boundsR2) !== op.place) return null

  return { opponent: oppTeam, gameNum, round: 'QF' }
}
