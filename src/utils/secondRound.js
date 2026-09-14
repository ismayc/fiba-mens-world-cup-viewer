// The second group stage: the one computation the family did not already have.
//
// Eight first-round groups A-H send their top two into four second-round groups
// I-L. FIBA merges adjacent pairs: A&B -> I, C&D -> J, E&F -> K, G&H -> L. A
// second-round group therefore has four teams (the two qualifiers from each
// feeding group) and plays a full four-team round-robin, except two of its six
// games were already played in the first round (the intra-pair head-to-heads) and
// CARRY OVER. Only the four cross games are new.
//
// The carryover needs no special arithmetic: once membership is known, the
// second-round table is just rankGroup(members, games), because gamesAmong()
// (qualification.js) already collects a set of teams' group-stage games by
// membership, which picks up the two carried-over games automatically. This
// module's whole job is to work out WHO is in each second-round group, which it
// can only do once both feeding first-round groups are decided.

import {
  R2_MEMBERSHIP,
  SECOND_ROUND_GROUPS,
  FIRST_ROUND_GROUPS,
  ADVANCING_PER_GROUP,
  rankGroup,
  groupComplete,
} from './qualification.js'
import { TEAMS } from '../data/teams.js'

// The two teams that advance from a first-round group, in finishing order, or
// null when the group is not yet decided. A group is "decided" for this purpose
// once its top two are settled even if 3rd/4th are not, but we keep it simple and
// require the whole group complete: the second-round schedule cannot be seeded
// until the feeding groups finish, which is how FIBA runs it.
export function advancersFrom(group, games) {
  if (!groupComplete(TEAMS[group], games)) return null
  return rankGroup(TEAMS[group], games)
    .slice(0, ADVANCING_PER_GROUP)
    .map((r) => r.name)
}

// The resolved member team objects of a second-round group, or null when either
// feeding first-round group is undecided. Order is [group1 winner, group1
// runner-up, group2 winner, group2 runner-up], which is stable but not the
// ranking; rankGroup re-orders by results.
export function r2Members(r2key, games) {
  const [g1, g2] = R2_MEMBERSHIP[r2key]
  const a = advancersFrom(g1, games)
  const b = advancersFrom(g2, games)
  if (!a || !b) return null
  const byName = {}
  for (const g of FIRST_ROUND_GROUPS) for (const t of TEAMS[g]) byName[t.name] = t
  return [...a, ...b].map((name) => byName[name])
}

// The ranked second-round table for a group, or null when its membership is not
// yet resolved.
export function rankSecondRound(r2key, games) {
  const members = r2Members(r2key, games)
  if (!members) return null
  return rankGroup(members, games)
}

// Is a second-round group's own table complete (all six of its games, four new
// plus two carried over, final)?
export function secondRoundComplete(r2key, games) {
  const members = r2Members(r2key, games)
  if (!members) return false
  return groupComplete(members, games)
}

// Full second-round picture, mirroring computeQualification for the first round.
export function computeSecondRound(games) {
  const groups = {}
  const members = {}
  const completion = {}
  for (const key of SECOND_ROUND_GROUPS) {
    members[key] = r2Members(key, games)
    groups[key] = members[key] ? rankGroup(members[key], games) : null
    completion[key] = members[key] ? groupComplete(members[key], games) : false
  }
  const allSeeded = SECOND_ROUND_GROUPS.every((k) => members[k])
  const allComplete = SECOND_ROUND_GROUPS.every((k) => completion[k])
  return { groups, members, completion, allSeeded, allComplete }
}
