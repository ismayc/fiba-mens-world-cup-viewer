# FIBA Men's World Cup 2023 Schedule Viewer

[![CI](https://github.com/ismayc/fiba-mens-world-cup-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ismayc/fiba-mens-world-cup-viewer/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://ismayc.github.io/fiba-mens-world-cup-viewer/coverage.json)](https://github.com/ismayc/fiba-mens-world-cup-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A React + Vite web app for the 2023 FIBA Men's Basketball World Cup, co-hosted by
the Philippines, Japan and Indonesia, showing all 92 games in **your** timezone,
with the two group stages, group standings, the knockout bracket, and the full FIBA
tie-breaker and qualification math.

🔗 **Live:** https://ismayc.github.io/fiba-mens-world-cup-viewer/ · https://fiba-mens-world-cup-viewer.netlify.app

GitHub Pages is the canonical public URL and the one the link-preview card points
at. Netlify is the mirror that keeps deploying when GitHub Actions is down, and it
is also the only host that can serve `/calendar.ics`, since that feed is a Netlify
function.

## The real, completed tournament

This viewer carries the real 2023 tournament: all 92 games with the teams, scores,
dates and venues that actually happened, verified against Wikipedia's own group and
knockout tables. Germany won it, beating Serbia in the final; Canada took bronze
past the United States. It was co-hosted by the Philippines, Japan and Indonesia
across five arenas in five cities, and ran 25 August to 10 September 2023.

Building the real tournament uncovered **two bugs in the format engine** that the
earlier synthetic placeholder could never have shown, because the placeholder's
tests were self-consistent with the wrong engine. See "Notes for contributors"
below.

## The format, and why it shapes the app

32 teams, played in three phases. This is unlike any other viewer in this family:

- **First round:** eight groups (A-H) of four, round-robin. The **top two of each
  group advance**; the bottom two drop to the 17th-32nd classification.
- **Second round:** four groups (I-L) of four, formed by merging pairs of
  first-round groups (**A&B → I, C&D → J, E&F → K, G&H → L**). Each qualifier
  **carries its whole first-round record forward** (all three first-round games,
  including those against the teams that did not advance) and plays two new games, so
  a second-round table is a **five-game record**. The **top two of each advance** to
  the knockout.
- **Knockout:** a balanced eight-team bracket, quarter-finals to Final, plus a
  third-place game. The second-round groups **cross I↔J and K↔L**, so a group's
  winner and runner-up can only meet again in the Final.

**FIBA's points are not football's.** A win is 2 points and **a loss is 1**; only a
forfeit scores 0. And head-to-head is the *first* tie-breaker, ahead of overall
point difference.

The classification games (17th-32nd and 5th-8th) are in the schedule for
completeness but are not bracketed: the engine ranks the top 16 seriously.

## Features

- **Your timezone** — tip-off times auto-convert to your detected timezone. The
  five arenas span three timezones (the Philippines at UTC+08:00, Okinawa at
  UTC+09:00, Jakarta at UTC+07:00), and each game's clock comes from its own venue.
- **Hover for home-country time** — hover a team to see when the game tips off back
  home; countries spanning several zones list each distinct local time.
- **Follow teams** — star any team to highlight it everywhere and filter to a
  one-click "⭐ My Teams" view (saved in your browser).
- **Next-game bar** — a countdown to the next tip-off (prioritizing your followed
  teams, or "Live now"), with a jump-to-game button.
- **Result alerts** — opt-in 🔔 on-page toasts and browser notifications the moment
  a game goes final, scoped to your followed teams or all games.
- **Five views** — chronological schedule, a week calendar, the two group stages,
  Scenarios, and the knockout bracket.
- **Group standings** with FIBA's columns (P W L PF PA PD Pts) and the full
  tie-breaker chain, a **Finish** column showing the placings still arithmetically
  open to each team, and clinch badges (🥇 won group · ✅ advanced · ❌ out) the
  moment an outcome is mathematically settled, for both group stages.
- **"As it stands"** — where each first-round group's top two would carry in the
  second round, and where each second-round group's top two would land in the
  knockout, with the projected opponent.
- **Scenarios** — pick the winner of each remaining first-round game (no draw
  button; basketball plays overtime until someone wins) and watch the tables and
  the projected second round recompute exactly.
- **Bracket** — the eight-team knockout with FIBA's slot labels, candidate pairs
  for unresolved feeds, and any team's path to the Final.
- **Spoiler-free mode** — hide every score behind a tap-to-reveal.
- **Calendar** — add a single game, export a filtered set, or subscribe to an
  auto-updating `webcal://` feed.

## Data

One frozen authority. `scripts/official.mjs` holds the real, completed 2023
tournament: every team, group, score, date and venue, parsed from Wikipedia's
per-group tables and cross-checked (the standings this data produces match
Wikipedia's own group tables exactly, and the resolved bracket matches the real
quarter-finals, semi-finals and final). ESPN's `basketball/fiba` slug is
time-multiplexed and does not serve the 2023 event, so there is no live feed to
overlay: this build is the whole pipeline.

```bash
npm run build:data              # write src/data/{games,teams,venues}.js from official.mjs
```

## Develop

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # the suite
npm run test:coverage  # with the coverage gate
npm run build
```

## Notes for contributors

[`ARCHITECTURE.md`](./ARCHITECTURE.md) is the map of how the code is laid out and
how data flows through it. [`NEWS.md`](./NEWS.md) is the dated changelog. Each
module's header comment is the authoritative spec for that module. Read it before
changing the code under it.

The suite runs at **100% coverage** on statements, branches, functions and lines,
and `vite.config.js` enforces all four. A genuinely unreachable defensive arm
carries an inline `/* v8 ignore next -- why */`; lowering a threshold is not an
option.

Things in this repo that exist to stop a specific bug coming back, and should not
be "simplified":

1. **The second-round carryover in `src/utils/qualification.js` and
   `src/utils/secondRound.js`.** A second-round group is ranked over each member's
   FULL five-game record (its whole first-round record, including games against
   teams that did not advance, plus its two new second-round games), via
   `carryoverGames`. It is NOT the games among the four members alone. FIBA's rule is
   explicit ("all five group stage games counting"), and the 2023 data proves it:
   ranking by the three among-member games flips Group I to Serbia > Italy, when the
   real order is Italy > Serbia. Do not reintroduce the among-members-only model.
2. **The knockout crossover in the game labels (`scripts/official.mjs`), read by
   `src/utils/bracket.js`.** The second-round groups cross **I with J and K with L**
   (QF: Winner I vs 2nd J, Winner J vs 2nd I, Winner K vs 2nd L, Winner L vs 2nd K).
   This is the real 2023 wiring, verified: Italy (1st I) met the United States (2nd
   J), Germany (1st K) met Latvia (2nd L). Do not "tidy" it into I with L / J with K.
3. **`site.web.api.espn.com`, not `site.api.espn.com`.** The two serve identical
   routes, but `site.api` returns 403 to datacenter IPs, which is every CI runner
   and every Netlify function.

## Credits

An unofficial fan-made project. Not affiliated with, endorsed by, or sponsored by
FIBA. "FIBA Basketball World Cup", team, broadcaster and tournament names are
trademarks of their respective owners. Schedule and results data compiled from
[FIBA](https://www.fiba.basketball/) and
[Wikipedia](https://en.wikipedia.org/wiki/2023_FIBA_Basketball_World_Cup). The app
icon (a basketball on the app's dark ground with a maroon base) and the social card
use [Google Noto Emoji](https://github.com/googlefonts/noto-emoji) (Apache License
2.0).

Created by [Chester Ismay](https://github.com/ismayc) · MIT licensed.
