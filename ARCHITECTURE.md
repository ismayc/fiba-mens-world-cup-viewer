# Architecture

How the FIBA Men's World Cup 2027 viewer is laid out, and the handful of format
facts that shape every part of it. Read this before touching the engine or the
tables; the module header comments carry the rest.

## The format, and why it shapes the code

32 teams, three phases, plus parallel classification. This is the most complex
format in the sports-trackers family, and none of the other viewers models it.

1. **First round.** Eight groups A-H of four, single round-robin (6 games each,
   48 total). Top two of each group advance; bottom two drop to the 17th-32nd
   classification.
2. **Second round.** Four groups I-L of four, formed by merging pairs of
   first-round groups: **A&B → I, C&D → J, E&F → K, G&H → L**. The two
   co-qualifiers' first-round game **carries over** and counts in the second-round
   table, so each team plays only two NEW games (16 new games total) and the table
   is a four-team round-robin whose six games were played across two rounds. Top
   two of each group advance.
3. **Knockout.** A balanced eight-team bracket: quarter-finals (85-88), semi-finals
   (89-90), third-place game (91) and Final (92).

Total: 48 + 16 + 16 (17-32) + 4 (5-8) + 8 (knockout) = **92 games**.

### Consequence 1: the engine is generic over "a group's members"

The carryover is the one genuinely new computation, and the trick is that it needs
no special arithmetic. A second-round group's table is just the standings over the
games played *among its four members* in the group phase, which automatically
includes the one first-round game between the two co-qualifiers. So
`rankGroup(members, games)` in `src/utils/qualification.js` takes a member list,
not a group key, and `gamesAmong(names, games)` finds their games by membership.
`src/utils/secondRound.js` works out the membership (top two of each feeding group)
once the first round is decided, then hands it to the same `rankGroup`.

**Do not** reintroduce a `stage === 'R1' && group === X` filter into the standings:
it would drop the carried-over game and rank the second round on two games instead
of three.

### Consequence 2: the knockout crossover, and no bye

The eight quarter-finalists are the top two of the four second-round groups. The
wiring (`BRACKET` in `src/utils/bracket.js`):

```
QF  85: 1st I - 2nd L      86: 1st L - 2nd I
    87: 1st J - 2nd K      88: 1st K - 2nd J
SF  89: W85 - W87          90: W86 - W88
3rd 91: L89 - L90          Final 92: W89 - W90
```

The groups cross **I↔L and J↔K**. A group's winner and runner-up are placed in
opposite halves, so they can only meet again in the Final. This is the wiring FIBA
used in 2023 (verified against that tournament's results: Germany [1st I] met
Latvia [2nd L], Canada [1st L] met Slovenia [2nd I], and so on). **FIBA has not
published the 2027 bracket**, so this is the working default and must be re-checked
when the 2027 sheet appears. Unlike the women's edition there is **no bye**: the
bracket is a balanced 4-4 and every quarter-final has two group-fed slots.

### Consequence 3: FIBA points and tie-breakers

A win is 2 points, a **loss is 1**, a forfeit 0. Tie-breakers, in order: points →
head-to-head points → h2h point difference → h2h points scored → overall point
difference → overall points scored → drawing of lots (stood in for by FIBA World
Ranking order via `byLots`). Head-to-head is criterion 2, **before** overall point
difference, the reverse of the FIFA football siblings. FIBA also **restarts** the
procedure when a criterion splits some but not all of a tied set; see `resolveTie`.

### Consequence 4: one timezone

All four arenas are in the Doha metropolitan area (Lusail, Doha, Al Rayyan, Al
Wakrah) on Asia/Qatar (+03:00) with no DST, so the tournament has exactly one
offset, and no game crosses a UTC day boundary (`guards.test.js` asserts it). This
is the same simplification the women's Berlin edition had; the multi-timezone
machinery the football siblings need is deliberately absent.

### Consequence 5: classification is not bracketed

The 17th-32nd (groups M-P) and 5th-8th games exist in the schedule (stage
`Class`), so the day/week/schedule views show a complete tournament, but the engine
ranks the top 16 only. Classification games carry honest feeder labels and are
never resolved to teams. This mirrors how the women's viewer treats a 4th-place
team: out, not bracketed.

## The placeholder draw

The real 2027 draw is not held until spring 2027, and only Qatar and Türkiye have
qualified. Everything team-specific is therefore a **placeholder**: an illustrative
32-team field (`GROUPS` in `scripts/official.mjs`), a generated 92-game schedule,
and provisional Doha-metro venues. The UI labels this state (the header banner, the
"seeded once the first round finishes" second-round note, the share card). The
FORMAT, host, host cities, window and tie-breakers are verified; the field, the
fixtures and the specific venue assignments are not. When FIBA publishes the real
draw, `scripts/official.mjs` is rewritten and the data regenerated; the engine and
its tests do not change.

## Data flow

```
scripts/official.mjs   (the frozen authority: format + placeholder schedule)
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

At runtime `App.jsx` overlays the live ESPN feed (`src/services/espn.js`, matched
by `espnId`) onto the committed board, then resolves the bracket
(`resolveBracket`): first-round tables fill the second-round games, second-round
tables fill the quarter-finals, and knockout winners/losers propagate up to the
Final. All resolution is conservative: a slot stays a placeholder until its outcome
is genuinely settled.

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
`vite.config.js`. Tests start from the frozen no-scores board in
`test/fixtures/pretournament-games.js` (never `src/data/games.js`, which is
regenerated), with clock-dependent tests pinned via `test/helpers/tournament.js`.
Repo-level invariants (storage prefix `fmwc:`, the ESPN host, the Qatar calendar
day, generated-data banners) live in `test/guards.test.js`.
