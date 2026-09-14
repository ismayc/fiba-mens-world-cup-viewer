# Architecture

How the 2023 FIBA Men's World Cup viewer is laid out, and the handful of format
facts that shape every part of it. Read this before touching the engine or the
tables; the module header comments carry the rest.

## The format, and why it shapes the code

32 teams, three phases, plus parallel classification. This is the most complex
format in the sports-trackers family, and none of the other viewers models it.

1. **First round.** Eight groups A-H of four, single round-robin (6 games each,
   48 total). Top two of each group advance; bottom two drop to the 17th-32nd
   classification.
2. **Second round.** Four groups I-L of four, formed by merging pairs of
   first-round groups: **A&B → I, C&D → J, E&F → K, G&H → L**. Each qualifier
   **carries its full first-round record forward** (all three first-round games) and
   plays two NEW games (16 new games total), so a second-round table is a five-game
   record. Top two of each group advance.
3. **Knockout.** A balanced eight-team bracket: quarter-finals (85-88), semi-finals
   (89-90), third-place game (91) and Final (92).

Total: 48 + 16 + 16 (17-32) + 4 (5-8) + 8 (knockout) = **92 games**.

### Consequence 1: the second-round carryover is a five-game record

The carryover is the one genuinely new computation, and it is NOT just the games
among the four members. FIBA carries each qualifier's ENTIRE first-round record
forward: all three of its first-round games (including those against the two teams
that did not advance) plus its two new second-round games, for a five-game record.
FIBA's competition system states it plainly ("all five group stage games counting
towards their records"), and the real 2023 data proves it: ranking Group I by only
the three among-members games gives Serbia > Italy, when the real, published order
is Italy > Serbia.

So `rankGroup(members, games, collect)` in `src/utils/qualification.js` takes a
member list and a game collector: `gamesAmong` (both sides members) for a
first-round group, and `carryoverGames` (a game counted for any member side it
contains) for a second-round group. `baseStats` credits each member side of a game
independently, so a member's first-round win over a non-advancer still counts.
`src/utils/secondRound.js` works out the membership and passes `carryoverGames`; the
clinch engine (`clinch.js`) does the same via a `secondRound` flag.

**Do not** revert to ranking the second round on the games among the four members
alone: that was a real bug (the second round showed a three-game record and the
wrong first/second seeding), fixed here and frozen into the tests as a regression.

### Consequence 2: the knockout crossover, and no bye

The eight quarter-finalists are the top two of the four second-round groups. The
wiring (`BRACKET` in `src/utils/bracket.js`):

```
QF  85: 1st I - 2nd J      86: 1st J - 2nd I
    87: 1st K - 2nd L      88: 1st L - 2nd K
SF  89: W85 - W87          90: W86 - W88
3rd 91: L89 - L90          Final 92: W89 - W90
```

The groups cross **I↔J and K↔L**. A group's winner and runner-up are placed in
opposite halves, so they can only meet again in the Final. This is the real 2023
wiring, verified against the tournament: Italy (1st I) met the United States (2nd
J), Lithuania (1st J) met Serbia (2nd I), Germany (1st K) met Latvia (2nd L), and
Canada (1st L) met Slovenia (2nd K). The wiring lives in the game LABELS in
`scripts/official.mjs`; `src/utils/bracket.js` reads them and does not hardcode it.
Unlike the women's edition there is **no bye**: the bracket is a balanced 4-4 and
every quarter-final has two group-fed slots.

An earlier crossover here was I↔L / J↔K; that was a bug (it did not match the real
2023 bracket), fixed and frozen into the tests.

### Consequence 3: FIBA points and tie-breakers

A win is 2 points, a **loss is 1**, a forfeit 0. Tie-breakers, in order: points →
head-to-head points → h2h point difference → h2h points scored → overall point
difference → overall points scored → drawing of lots (stood in for by FIBA World
Ranking order via `byLots`). Head-to-head is criterion 2, **before** overall point
difference, the reverse of the FIFA football siblings. FIBA also **restarts** the
procedure when a criterion splits some but not all of a tied set; see `resolveTie`.

### Consequence 4: three timezones

2023 was co-hosted across five arenas on THREE timezones: the Philippines (Manila
metro: Philippine Arena, Mall of Asia Arena, Araneta Coliseum) at +08:00, Okinawa
in Japan at +09:00, and Jakarta in Indonesia at +07:00, none observing DST. Each
game is stored at its own venue's local wall clock, and the clock a game is shown in
comes from `VENUES[game.venue].tz` (`src/utils/venue.js`), not from a single
tournament zone. The timezone picker (`src/utils/time.js`) adds every venue's zone
so all three host clocks are selectable (Jakarta's is not any competing nation's).
Unlike the women's single-city Berlin edition, this viewer genuinely spans zones.

### Consequence 5: classification is not bracketed

The 17th-32nd (groups M-P) and 5th-8th games exist in the schedule (stage
`Class`), so the day/week/schedule views show a complete tournament, but the engine
ranks the top 16 only. Classification games carry honest feeder labels and are
never resolved to teams. This mirrors how the women's viewer treats a 4th-place
team: out, not bracketed.

## The data is real and frozen

`scripts/official.mjs` holds the real, completed 2023 tournament: the 32-team field,
all 92 games with their teams, scores, dates and venues, parsed from Wikipedia's
per-group and knockout tables and cross-checked. The standings the engine computes
from this data match Wikipedia's own group tables exactly (all eight first-round and
all four second-round groups), and `resolveBracket` reproduces the real
quarter-finals, semi-finals, third-place game and final. ESPN's `basketball/fiba`
slug is time-multiplexed and does not serve the 2023 event, so there is no live feed
to overlay; `npm run build:data` writes `src/data/{games,teams,venues}.js` from the
authority and that is the whole pipeline.

The tests build partial and pre-tournament states from a "nothing played" snapshot
(`test/fixtures/pretournament-games.js`, the real schedule with every result
removed), so a test that overlays one group's results does not inherit the other 91
games' real outcomes.

## Data flow

```
scripts/official.mjs   (the frozen authority: the real, completed 2023 tournament)
        │  npm run build:data
        ▼
src/data/{games,teams,venues}.js   (generated, committed, do-not-edit)
        │
        ▼
src/utils/*   (qualification → secondRound → clinch → bracket → bracketResolve)
        │
        ▼
src/components/*   (Schedule, Week, Standings, Scenarios, Bracket)
```

At runtime `App.jsx` still runs the live-overlay path (`src/services/espn.js`,
matched by `espnId`), but the 2023 event has no ESPN feed, so it is inert and the
committed, already-complete board passes straight through. It then resolves the
bracket (`resolveBracket`): first-round tables fill the second-round games,
second-round tables fill the quarter-finals, and knockout winners/losers propagate
up to the Final. All resolution is conservative: a slot stays a placeholder until
its outcome is genuinely settled. The overlay and resolver stay in place so the
family's shared machinery is unchanged.

## The modules

- `src/utils/qualification.js` — FIBA standings generic over a group's members;
  `computeQualification` (first round), `rankGroup`, the tie-break chain, the group
  and advancement constants.
- `src/utils/secondRound.js` — second-round membership, ranking and completion; the
  carryover computation.
- `src/utils/clinch.js` — win/loss enumeration (≤ 2^6 per group) for clinch,
  elimination and the Finish column, for both stages.
- `src/utils/slots.js` — the slot-label grammar (`Winner Group X` / `2nd Group X`
  for A-L, `Winner/Loser Game N`) and `stageLabel`.
- `src/utils/bracket.js` — the knockout `BRACKET`, the crossover, and route tracing.
- `src/utils/bracketResolve.js` — the two-level resolver.
- `src/utils/asItStands.js` / `opponentClinch.js` / `scenarios.js` /
  `tiebreakNotes.js` — projections, locked opponents, first-round what-ifs, and the
  "decided by lots" markers.

## Testing

Vitest + jsdom, 100% coverage enforced on `src/**` and `netlify/functions/**` by
`vite.config.js`. Tests that need a partial or pre-tournament state start from the
frozen no-scores board in `test/fixtures/pretournament-games.js`; tests that assert
the real 2023 results read `src/data/games.js` directly. Clock-dependent tests are
pinned via `test/helpers/tournament.js`. Repo-level invariants (storage prefix
`fmwc:`, the ESPN host, the per-venue calendar day, generated-data banners) live in
`test/guards.test.js`.
