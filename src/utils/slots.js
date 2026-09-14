// How to read a knockout game's ORIGINAL bracket slot labels, and which round the
// group phase feeds into.
//
// A game record carries its slot labels in one of two ways, and every engine that
// reasons about the bracket needs the same answer from both:
//
//   • Before it is played, `t1`/`t2` may BE the labels ("Winner Group I"),
//     exactly as the fixture list was drawn.
//   • Once the teams are known, `t1`/`t2` hold the real teams and the labels stay
//     in `label1`/`label2`, so the bracket still knows the provenance of each
//     slot, which is what lets it print "Winner Group I" under a team name.
//
// This edition ships with `label1`/`label2` set on all eight knockout games from
// the start and `t1`/`t2` null until results resolve them, because FIBA publishes
// the wiring long before the teams. Reading `t1` directly would work only for a
// decided tournament and would show nothing at all right now.
//
// ── UNLIKE THE WOMEN'S EDITION, THERE IS NO BYE ──
// The men's knockout is a clean eight-team single-elimination bracket. All eight
// quarter-finalists are the top two of the four SECOND-ROUND groups (I-L), so
// every group-fed slot names a second-round group and a placing of 1 or 2. There
// is no group-winner bye and no third-place feeder, so the ENTRY_ROUND / BYE_ROUND
// / enteredAt machinery the women's edition needed is gone.

import { FIRST_ROUND_GROUPS, SECOND_ROUND_GROUPS } from './qualification.js'
import { STAGE_LABELS } from '../data/games.js'

// The human label for a game's stage, used by every card and modal. A group-stage
// game (first or second round) reads as its group ("Group A", "Group I"); a
// classification game reads as its own label; everything else uses STAGE_LABELS.
export function stageLabel(m) {
  if (m.stage === 'R1' || m.stage === 'R2') return `Group ${m.group}`
  if (m.stage === 'Class') return m.classLabel || STAGE_LABELS.Class
  return STAGE_LABELS[m.stage]
}

// The knockout's only group-fed round: the quarter-finals. Every quarter-final
// slot is filled directly from a second-round group table.
export const ENTRY_ROUND = 'QF'

// Group letters actually in use, as a regex character class, so a stray label
// naming a group this edition doesn't have fails to parse instead of quietly
// resolving to nothing halfway through. BOTH stages appear: a placing label names
// a first-round group (A-H, on the second-round games) or a second-round group
// (I-L, on the quarter-finals). The two are told apart by the game's stage, not by
// the letter.
export const GROUP_CLASS = `[${[...FIRST_ROUND_GROUPS, ...SECOND_ROUND_GROUPS].join('')}]`

export const WINNER_GROUP = new RegExp(`^Winner Group (${GROUP_CLASS})$`)
export const SECOND_GROUP = new RegExp(`^2nd Group (${GROUP_CLASS})$`)

// FIBA calls them GAMES, not matches, and the labels on the official sheet read
// "Winner Game 89". The football siblings parse "Winner Match N"; the wording is
// part of the data, so the patterns differ deliberately.
export const WINNER_GAME = /^Winner Game (\d+)$/
export const LOSER_GAME = /^Loser Game (\d+)$/
export const FEED_LABEL = /^(Winner|Loser) Game (\d+)$/

// The placing a group-fed label refers to: 1 or 2, with the second-round group
// letter. Returns null for a feed label or a real team name.
export function groupPlacing(label) {
  let hit = WINNER_GROUP.exec(label)
  if (hit) return { group: hit[1], place: 1 }
  hit = SECOND_GROUP.exec(label)
  if (hit) return { group: hit[1], place: 2 }
  return null
}

// The two slot labels a game was drawn with, whether or not it has been played.
export function slotLabels(g) {
  return [g.label1 ?? g.t1, g.label2 ?? g.t2]
}

// The two sides of a game AS DISPLAYED: the resolved team when there is one,
// otherwise the slot label it was drawn with.
//
// Every view needs this, and getting it wrong is silent. A knockout record carries
// `t1: null` until results resolve it, so a component that reads `game.t1`
// directly renders the whole knockout with BLANK team names. Read sides through
// here.
export function sideNames(g) {
  return [g.t1 ?? g.label1 ?? '', g.t2 ?? g.label2 ?? '']
}

// Every game whose slots are filled directly from a group table: only the
// quarter-finals here, each of whose two slots is a second-round group placing.
export function groupFedGames(games) {
  return games.filter((g) => g.stage === ENTRY_ROUND)
}

// The round a second-round group placing enters the bracket at: both the winner
// and the runner-up enter at the quarter-finals. 3rd/4th do not advance.
export function enteredAt(place) {
  return place === 1 || place === 2 ? ENTRY_ROUND : null
}
