// Group ranking + qualification using FIBA's official classification rules
// (FIBA Internal Regulations, Book 2, applied to the 2023 Men's World Cup).
//
// THE POINTS SYSTEM IS NOT FOOTBALL'S. A win is 2 points, a LOSS IS 1 POINT, and
// only a forfeit scores 0. Every team plays three games inside a group, so a
// team's total is 3 + wins and the order by points is identical to the order by
// wins, but the table shows FIBA points, because that is what the organizer
// publishes and what the tie-break rules are written against.
//
// Criteria, applied to teams level on points:
//   1. Points earned in all group games
//   Then, among the tied teams, over the games BETWEEN THEM only:
//   2. Head-to-head points
//   3. Head-to-head point difference
//   4. Head-to-head points scored
//   Then, among teams still level, over ALL group games:
//   5. Point difference
//   6. Points scored
//   Then: a drawing of lots.
//
// NOTE the order: head-to-head comes BEFORE overall point difference. That is
// the OPPOSITE of the FIFA World Cup football siblings, where overall goal
// difference is criterion 2 and head-to-head is only criterion 4. Do not
// "restore" it.
//
// FIBA ALSO RESTARTS THE PROCEDURE, which football does not. When a criterion
// separates some but not all of a tied set, the teams that are still level are
// re-ranked from criterion 1 using a fresh sub-table among only themselves. See
// resolveTie().
//
// ── THE MEN'S TWO-STAGE FORMAT, AND THE CARRYOVER RULE ──
// The men's tournament has TWO group stages. Eight first-round groups A-H of four
// send their top two into four second-round groups I-L (A&B -> I, C&D -> J,
// E&F -> K, G&H -> L).
//
// The carryover is NOT just the one head-to-head between the two co-advancers.
// FIBA carries each qualifier's ENTIRE first-round record forward: a team arrives
// in the second round with all three of its first-round results (including its
// games against the two teams that did NOT advance) and then plays two new games,
// so its second-round table shows a FIVE-game record. FIBA's competition system
// states it plainly: "all five group stage games counting towards their records."
// (Verified against the real 2023 tournament: Serbia's second-round table in
// Group I is 4-1 over 5 games, not 2-1 over the 3 games among the four members.)
//
// So a second-round member's counting games are collected by carryoverGames()
// (below), which takes every group-stage game the team played, not only the games
// strictly among the four members. rankGroup() therefore takes a list of member
// teams plus a game collector: gamesAmong() for a first-round group, carryoverGames()
// for a second-round group. utils/secondRound.js supplies the second-round
// membership once the feeding first-round groups are decided.
//
// The head-to-head tie-break (criteria 2-4) still uses only the games BETWEEN the
// tied teams (gamesAmong of the tied set), and completion is still measured over
// the six games among the four members; only the record (criteria 1, 5, 6) counts
// all five of a team's games.
//
// There is no fair-play criterion in basketball, so nothing reads a card feed.

import { TEAMS, RANK_BY_TEAM } from '../data/teams.js'

// The eight first-round groups, in draw order.
export const FIRST_ROUND_GROUPS = Object.keys(TEAMS)

// Which first-round groups feed each second-round group. FIBA merges adjacent
// pairs. The four cross games are played in the second round; each qualifier's
// full first-round record carries forward (see carryoverGames). This is the 2023
// membership (A&B -> I, C&D -> J, E&F -> K, G&H -> L).
export const R2_MEMBERSHIP = { I: ['A', 'B'], J: ['C', 'D'], K: ['E', 'F'], L: ['G', 'H'] }
export const SECOND_ROUND_GROUPS = Object.keys(R2_MEMBERSHIP)

export const GROUP_GAME_COUNT = 6 // 4 teams => 6 games per group, in either stage

// FIBA's points scale.
export const WIN_POINTS = 2
export const LOSS_POINTS = 1

// How many teams survive each group. The top two of each first-round group reach
// the second round; the top two of each second-round group reach the knockout.
// The same number governs both stages, which is why it is a single constant. This
// is the single source of truth for the clinch, elimination and projection
// engines, which all import it from here.
export const ADVANCING_PER_GROUP = 2

// A game belongs to the group phase (first or second round) rather than the
// knockout or a classification placement game. Only these games rank a group, and
// the membership test below relies on it: two group-mates can meet AGAIN in the
// knockout, and that later game must not leak into their group table.
export const isGroupStage = (g) => g.stage === 'R1' || g.stage === 'R2'

// FIBA settles a total tie by drawing lots, which no viewer can compute. This
// stands in for it with the FIBA World Ranking (see RANK_BY_TEAM), strongest
// first, so the order is stable, repeatable and a defensible guess at what the
// draw would produce. It is a DISPLAY order, not FIBA's rule:
// utils/tiebreakNotes.js still surfaces "would have gone to lots" wherever it
// actually bites, so the table never claims the ranking decided anything.
//
// It matters most before a ball is thrown. With every team 0-0 a whole group is
// one tied block, so this comparator alone orders the opening table and the
// projected bracket; alphabetical order put a placeholder above a contender.
export const byLots = (a, b) => RANK_BY_TEAM[a] - RANK_BY_TEAM[b]

function blank(team) {
  return { ...team, P: 0, W: 0, L: 0, PF: 0, PA: 0, PD: 0, Pts: 0 }
}

// The group-stage games played strictly among `names` (BOTH sides in the set),
// final and decisive. This ranks a FIRST-ROUND group (its six games) and is also
// the head-to-head set for the tie-break in either stage (the games between a set
// of tied teams).
export function gamesAmong(names, games) {
  const set = new Set(names)
  return games.filter(
    (g) =>
      isGroupStage(g) &&
      set.has(g.t1) &&
      set.has(g.t2) &&
      g.score &&
      !g.voided &&
      g.score[0] !== g.score[1],
  )
}

// The group-stage games that count toward a SECOND-ROUND member's record: every
// decisive group-stage game the team played, whether or not the opponent is one of
// the four second-round members. This is the "all five group stage games" rule: a
// qualifier's three first-round games (including those against teams that did not
// advance) plus its two second-round games. A game where only one side is a member
// is included and credited to that member alone (see baseStats). It is NOT a
// symmetric among-the-four set, which is exactly why the second round differs from
// the first.
export function carryoverGames(names, games) {
  const set = new Set(names)
  return games.filter(
    (g) =>
      isGroupStage(g) &&
      (set.has(g.t1) || set.has(g.t2)) &&
      g.score &&
      !g.voided &&
      g.score[0] !== g.score[1],
  )
}

// A basketball game cannot be drawn: overtime is played until someone wins, so
// every scored game increments exactly one W and one L. Any record that claims a
// level final score is a data error rather than a draw, and gamesAmong() has
// already skipped it so it cannot silently award both teams a win.
function baseStats(members, games, collect = gamesAmong) {
  const rows = {}
  for (const t of members) rows[t.name] = blank(t)
  for (const g of collect(members.map((t) => t.name), games)) {
    const [p1, p2] = g.score
    const a = rows[g.t1]
    const b = rows[g.t2]
    // Credit each side that is a member INDEPENDENTLY. For a first-round group
    // both sides are always members (gamesAmong). For a second-round group,
    // carryoverGames() also returns a member's games against non-members (its
    // first-round results against teams that did not advance), where only the
    // member side is present and only it is credited.
    if (a) { a.P++; a.PF += p1; a.PA += p2; if (p1 > p2) a.W++; else a.L++ }
    if (b) { b.P++; b.PF += p2; b.PA += p1; if (p2 > p1) b.W++; else b.L++ }
  }
  for (const k in rows) {
    const r = rows[k]
    r.PD = r.PF - r.PA
    r.Pts = r.W * WIN_POINTS + r.L * LOSS_POINTS
  }
  return rows
}

// Head-to-head sub-table among exactly the given (tied) team names, counting only
// the group-stage games played between them.
export function headToHead(names, games) {
  const sub = {}
  for (const n of names) sub[n] = { Pts: 0, PD: 0, PF: 0 }
  for (const g of gamesAmong(names, games)) {
    const [p1, p2] = g.score
    sub[g.t1].PF += p1; sub[g.t2].PF += p2
    sub[g.t1].PD += p1 - p2; sub[g.t2].PD += p2 - p1
    if (p1 > p2) { sub[g.t1].Pts += WIN_POINTS; sub[g.t2].Pts += LOSS_POINTS }
    else { sub[g.t2].Pts += WIN_POINTS; sub[g.t1].Pts += LOSS_POINTS }
  }
  return sub
}

// Rank a set of teams that are level on points, per FIBA's criteria 2-6.
//
// `depth` guards the recursion: resolveTie recurses only when a pass has genuinely
// split the set into smaller pieces, so it terminates on its own, but a defensive
// cap keeps a malformed board from spinning.
function resolveTie(tied, games, depth = 0) {
  /* v8 ignore next -- unreachable: rankGroup only calls this for a block of 2+, and the recursion below is guarded by block.length > 1 */
  if (tied.length === 1) return tied

  const names = tied.map((t) => t.name)
  const sub = headToHead(names, games)

  // Criteria 2-4 among the tied teams only, then 5-6 across all group games.
  const sorted = [...tied].sort(
    (a, b) =>
      sub[b.name].Pts - sub[a.name].Pts ||
      sub[b.name].PD - sub[a.name].PD ||
      sub[b.name].PF - sub[a.name].PF ||
      b.PD - a.PD ||
      b.PF - a.PF ||
      byLots(a.name, b.name),
  )

  // FIBA's restart rule. Group the teams this pass could not separate and re-run
  // the whole procedure on each such block with a sub-table built from only its
  // own members, which is a different, smaller head-to-head table than the one
  // just used, and can order them differently.
  const same = (x, y) =>
    sub[x.name].Pts === sub[y.name].Pts &&
    sub[x.name].PD === sub[y.name].PD &&
    sub[x.name].PF === sub[y.name].PF &&
    x.PD === y.PD &&
    x.PF === y.PF

  const out = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && same(sorted[i], sorted[j])) j++
    const block = sorted.slice(i, j)
    // Only recurse when this pass actually shrank the set, or the restart would
    // rebuild the identical table and recurse forever.
    if (block.length > 1 && block.length < tied.length && depth < 4) {
      out.push(...resolveTie(block, games, depth + 1))
    } else {
      out.push(...block)
    }
    i = j
  }
  return out
}

// Rank a group given its member teams (in any order) and all tournament games.
// `collect` chooses the record set: gamesAmong (the default) ranks a first-round
// group (pass TEAMS[key]); carryoverGames ranks a second-round group (pass the
// resolved membership from utils/secondRound.js, and carryoverGames as collect),
// counting each qualifier's full five-game record.
export function rankGroup(members, games, collect = gamesAmong) {
  const rows = Object.values(baseStats(members, games, collect))
  // Criterion 1: FIBA points. Ties are then broken by resolveTie.
  rows.sort((a, b) => b.Pts - a.Pts)

  const ordered = []
  let i = 0
  while (i < rows.length) {
    let j = i + 1
    while (j < rows.length && rows[j].Pts === rows[i].Pts) j++
    const tied = rows.slice(i, j)
    ordered.push(...(tied.length > 1 ? resolveTie(tied, games) : tied))
    i = j
  }
  return ordered.map((r, idx) => ({ ...r, rank: idx + 1 }))
}

// A group is complete only when every game among its members is truly FINAL. A
// live game carries a provisional score, so counting it here would flip
// completion mid-game and let rowStatus emit a verdict off a score that can still
// change. Same final predicate as clinch.js and bracketResolve.js.
export function groupComplete(members, games) {
  const names = new Set(members.map((t) => t.name))
  return (
    games.filter(
      (g) =>
        isGroupStage(g) &&
        names.has(g.t1) &&
        names.has(g.t2) &&
        g.score &&
        !g.live &&
        !g.voided,
    ).length >= GROUP_GAME_COUNT
  )
}

// First-round qualification picture. Every first-round group is independent:
// there is no cross-group comparison, because all eight groups send the same two
// teams onward and the bottom two are simply out (17th-32nd). The second round is
// computed separately in utils/secondRound.js, which can only seed its groups once
// the feeding first-round groups here are decided.
export function computeQualification(games) {
  const groups = {}
  const completion = {}
  for (const g of FIRST_ROUND_GROUPS) {
    groups[g] = rankGroup(TEAMS[g], games)
    completion[g] = groupComplete(TEAMS[g], games)
  }
  const allComplete = FIRST_ROUND_GROUPS.every((g) => completion[g])
  return { groups, completion, allComplete }
}

// Per-row qualification status for a FIRST-ROUND standings table.
// 'r2'  = top two, advances to the second round
// 'out' = eliminated (17th-32nd, no further games that this viewer brackets)
// null  = group still in progress, so nothing is settled by position alone.
export function rowStatus(row, complete) {
  if (!complete) return null
  return row.rank <= ADVANCING_PER_GROUP ? 'r2' : 'out'
}

// Per-row qualification status for a SECOND-ROUND standings table.
// 'ko'  = top two, advances to the quarter-finals
// 'out' = finishes 9th-16th, out of the knockout
// null  = group still in progress.
export function rowStatusR2(row, complete) {
  if (!complete) return null
  return row.rank <= ADVANCING_PER_GROUP ? 'ko' : 'out'
}
