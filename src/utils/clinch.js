// Clinch / elimination detection. For each group we enumerate every possible
// win/loss outcome of its remaining games and ask what is already GUARANTEED for
// each team, using the FIBA tie-breakers in qualification.js.
//
// WHY THIS DOES NOT ENUMERATE SCORELINES, unlike the football siblings. A
// basketball game is decided by 40-120 points a side; walking those margins is
// combinatorially hopeless. FIBA's rules give a better lever: head-to-head is
// criterion 2, BEFORE overall point difference, and criteria 2-4 depend ONLY on
// the games played between the tied teams. So whenever the games among a tied
// block are already final, that block's order is fully determined no matter how
// the rest of the group turns out. The engine enumerates only WIN/LOSS outcomes
// (2^remaining, at most 64 for a 4-team group) and leaves any block whose internal
// games are unplayed, or which head-to-head cannot separate, as genuinely
// uncertain. An unresolved block is treated pessimistically, so the engine can
// only ever under-claim, never emit a false "clinched".
//
// ── TWO STAGES ──
// The same enumeration runs over a first-round group (four fixed teams, its six
// R1 games) and over a second-round group (the four qualifiers, their six games:
// two carried over from the first round plus four new). analyzeMembers() is
// generic over "a set of four teams and the games among them"; computeClinch()
// runs it on the first round and computeClinchR2() on the second, once the second
// round is seeded and its slots resolved to real teams.

import { TEAMS } from '../data/teams.js'
import {
  FIRST_ROUND_GROUPS,
  SECOND_ROUND_GROUPS,
  ADVANCING_PER_GROUP,
  LOSS_POINTS,
  WIN_POINTS,
  isGroupStage,
  headToHead,
} from './qualification.js'
import { r2Members } from './secondRound.js'
import { resolvePlacingSlots } from './bracketResolve.js'

// A game counts as decided only once it is FINAL. A live game carries a running
// score, but its outcome is not settled, so it is treated as remaining, exactly
// like an unplayed fixture.
const isFinal = (g) => g.score && !g.live && !g.voided

// All games (played or not) among a set of member teams, in the group phase. For a
// first-round group this is its six R1 games (by group tag); for a second-round
// group it is the four R2 games (by group tag) plus the two carried-over R1 games
// (both sides in the membership). Unplayed R2 games are matched by their group tag
// because their teams may still be placeholders; callers that enumerate must pass
// games whose R2 slots are already resolved (see computeClinchR2).
function groupGamesFor(memberNames, key, games) {
  const set = new Set(memberNames)
  return games.filter(
    (g) => isGroupStage(g) && (g.group === key || (set.has(g.t1) && set.has(g.t2))),
  )
}

// Order a block of teams level on points, as far as the tie-breakers can be known.
// Returns the block as an ordered list of RUNS: each run is a set of teams this
// engine cannot separate, and the runs themselves are in finishing order.
function blockRuns(block, played, assumedWins) {
  if (block.length === 1) return [block]

  const inBlock = new Set(block)
  const internalPending = assumedWins.some(([g]) => inBlock.has(g.t1) && inBlock.has(g.t2))
  if (internalPending) return [block]

  const sub = headToHead(block, played)
  const sorted = [...block].sort(
    (a, b) => sub[b].Pts - sub[a].Pts || sub[b].PD - sub[a].PD || sub[b].PF - sub[a].PF,
  )
  const same = (x, y) =>
    sub[x].Pts === sub[y].Pts && sub[x].PD === sub[y].PD && sub[x].PF === sub[y].PF

  const runs = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && same(sorted[i], sorted[j])) j++
    runs.push(sorted.slice(i, j))
    i = j
  }
  return runs
}

function runsForOutcome(names, played, assumedWins) {
  const pts = pointsFor(names, played, assumedWins)
  const order = [...names].sort((a, b) => pts[b] - pts[a])
  const runs = []
  let i = 0
  while (i < order.length) {
    let j = i + 1
    while (j < order.length && pts[order[j]] === pts[order[i]]) j++
    runs.push(...blockRuns(order.slice(i, j), played, assumedWins))
    i = j
  }
  return runs
}

function spansFromRuns(runs) {
  const out = {}
  let base = 0
  for (const run of runs) {
    for (const n of run) out[n] = { best: base, worst: base + run.length - 1 }
    base += run.length
  }
  return out
}

function pointsFor(names, played, assumedWins) {
  const pts = {}
  for (const n of names) pts[n] = 0
  const record = (winner, loser) => {
    pts[winner] += WIN_POINTS
    pts[loser] += LOSS_POINTS
  }
  for (const g of played) {
    const [a, b] = g.score
    if (a === b) continue
    if (a > b) record(g.t1, g.t2)
    else record(g.t2, g.t1)
  }
  for (const [g, winner] of assumedWins) {
    record(winner, winner === g.t1 ? g.t2 : g.t1)
  }
  return pts
}

// Walk every win/loss completion of `remaining`, calling back with the list of
// [game, assumedWinner] pairs. 2^remaining, at most 64 in a 4-team group.
function eachOutcome(remaining, fn) {
  const assumed = []
  const visit = (i) => {
    if (i === remaining.length) {
      fn(assumed)
      return
    }
    const g = remaining[i]
    for (const winner of [g.t1, g.t2]) {
      assumed.push([g, winner])
      visit(i + 1)
      assumed.pop()
    }
  }
  visit(0)
}

// Enumerate every win/loss completion of a group's remaining games and collect,
// per team, the window of final ranks (1-based) it can reach.
function analyzeMembers(names, all) {
  const played = all.filter(isFinal)
  const remaining = all.filter((g) => !isFinal(g))

  const reach = {}
  for (const n of names) reach[n] = { best: Infinity, worst: 0 }

  eachOutcome(remaining, (assumed) => {
    const spans = spansFromRuns(runsForOutcome(names, played, assumed))
    for (const n of names) {
      reach[n].best = Math.min(reach[n].best, spans[n].best + 1)
      reach[n].worst = Math.max(reach[n].worst, spans[n].worst + 1)
    }
  })

  return { names, reach }
}

// Every distinct final ORDERING of a first-round group still reachable, as
// "A>B>C>D" keys. Powers the Scenarios view's "how open is this group?" count.
export function reachableOrderings(group, games) {
  const names = TEAMS[group].map((t) => t.name)
  const all = groupGamesFor(names, group, games)
  const played = all.filter(isFinal)
  const remaining = all.filter((g) => !isFinal(g))

  const seen = new Set()
  eachOutcome(remaining, (assumed) => {
    for (const ord of expandRuns(runsForOutcome(names, played, assumed))) {
      seen.add(ord.join('>'))
    }
  })
  return seen
}

function expandRuns(runs) {
  let out = [[]]
  for (const run of runs) {
    const perms = permutations(run)
    const next = []
    for (const prefix of out) for (const p of perms) next.push(prefix.concat(p))
    out = next
  }
  return out
}

function permutations(items) {
  if (items.length <= 1) return [items]
  const out = []
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1))
    for (const p of permutations(rest)) out.push([items[i], ...p])
  }
  return out
}

// Turn a reach window into a clinch status. `advancing` teams reach the next stage.
//   'won-group' — guaranteed to finish 1st in the group
//   'advanced'  — guaranteed a top-two finish (into the next stage), placing open
//   'eliminated'— cannot reach the top two under any remaining results
//   null        — still undecided
function statusFromReach({ best, worst }) {
  if (worst <= 1) return 'won-group'
  if (worst <= ADVANCING_PER_GROUP) return 'advanced'
  if (best > ADVANCING_PER_GROUP) return 'eliminated'
  return null
}

// First-round clinch: team name -> status. Guaranteed top two means "into the
// second round"; eliminated means 17th-32nd.
export function computeClinch(games) {
  const status = {}
  for (const g of FIRST_ROUND_GROUPS) {
    const names = TEAMS[g].map((t) => t.name)
    const { reach } = analyzeMembers(names, groupGamesFor(names, g, games))
    for (const n of names) status[n] = statusFromReach(reach[n])
  }
  return status
}

// Second-round clinch: team name -> status, for the seeded second-round groups.
// Guaranteed top two means "into the quarter-finals"; eliminated means 9th-16th.
// Runs on games whose second-round slots have been resolved to real teams, so the
// unplayed R2 games have concrete sides to enumerate.
export function computeClinchR2(games) {
  const resolved = resolvePlacingSlots(games, ['R2'])
  const status = {}
  for (const key of SECOND_ROUND_GROUPS) {
    const members = r2Members(key, resolved)
    if (!members) continue
    const names = members.map((t) => t.name)
    const { reach } = analyzeMembers(names, groupGamesFor(names, key, resolved))
    for (const n of names) status[n] = statusFromReach(reach[n])
  }
  return status
}

// The window of final group positions (1-4) still open to each first-round team.
// best === worst means the position is locked. Powers the Finish column.
export function groupPositionBounds(games) {
  const out = {}
  for (const g of FIRST_ROUND_GROUPS) {
    const names = TEAMS[g].map((t) => t.name)
    const { reach } = analyzeMembers(names, groupGamesFor(names, g, games))
    for (const n of names) out[n] = { best: reach[n].best, worst: reach[n].worst }
  }
  return out
}

// The same, for the seeded second-round groups (positions 1-4 within the group).
export function groupPositionBoundsR2(games) {
  const resolved = resolvePlacingSlots(games, ['R2'])
  const out = {}
  for (const key of SECOND_ROUND_GROUPS) {
    const members = r2Members(key, resolved)
    if (!members) continue
    const names = members.map((t) => t.name)
    const { reach } = analyzeMembers(names, groupGamesFor(names, key, resolved))
    for (const n of names) out[n] = { best: reach[n].best, worst: reach[n].worst }
  }
  return out
}

// Teams whose first-round clinch status newly changed between two sets of results.
export function newlyClinched(beforeGames, afterGames) {
  const before = computeClinch(beforeGames)
  const after = computeClinch(afterGames)
  const changes = []
  for (const g of FIRST_ROUND_GROUPS) {
    for (const t of TEAMS[g]) {
      const now = after[t.name]
      if (now && now !== before[t.name]) changes.push({ team: t.name, group: g, status: now })
    }
  }
  return changes
}

// One-line announcement for a clinch change, for the notification email.
export function clinchHeadline({ team, group, status }) {
  switch (status) {
    case 'won-group':
      return `🥇 ${team} have WON Group ${group}`
    case 'advanced':
      return `✅ ${team} are THROUGH from Group ${group} to the second round`
    case 'eliminated':
      return `❌ ${team} are ELIMINATED from Group ${group}`
    /* v8 ignore next 2 -- unreachable: computeClinch only emits the three statuses above */
    default:
      return `${team} (Group ${group}): ${status}`
  }
}

// Short label + tooltip for a status, for the UI. Returns null for null status.
// The wording is stage-neutral ("top two", "the next stage") so the same badge
// serves both the first-round and second-round tables.
export function clinchBadge(status) {
  switch (status) {
    case 'won-group':
      return { cls: 'c-won', label: '🥇', text: 'Won group', title: 'Has clinched first place in the group' }
    case 'advanced':
      return { cls: 'c-in', label: '✅', text: 'Advanced', title: 'Has clinched a top-two finish, through to the next stage, placing still open' }
    case 'eliminated':
      return { cls: 'c-out', label: '❌', text: 'Eliminated', title: 'Cannot reach the top two under any remaining results' }
    default:
      return null
  }
}
