# FIBA Men's World Cup 2027 Schedule Viewer

[![CI](https://github.com/ismayc/fiba-mens-world-cup-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/ismayc/fiba-mens-world-cup-viewer/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/endpoint?url=https://ismayc.github.io/fiba-mens-world-cup-viewer/coverage.json)](https://github.com/ismayc/fiba-mens-world-cup-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A React + Vite web app for the FIBA Men's Basketball World Cup 2027 in Doha,
Qatar, showing all 92 games in **your** timezone, with the two group stages, group
standings, the knockout bracket, and the full FIBA tie-breaker and qualification
math.

🔗 **Live:** https://ismayc.github.io/fiba-mens-world-cup-viewer/ · https://fiba-mens-world-cup-viewer.netlify.app

GitHub Pages is the canonical public URL and the one the link-preview card points
at. Netlify is the mirror that keeps deploying when GitHub Actions is down, and it
is also the only host that can serve `/calendar.ics`, since that feed is a Netlify
function.

## The draw has not happened yet

As of late 2026 only **Qatar** (host) and **Türkiye** have qualified; the other 30
places are still in qualifying, and the draw that seeds the eight first-round
groups is not held until spring 2027. So the app ships a **placeholder** tournament:
an illustrative 32-team field drawn into groups, and a complete 92-game schedule
with Doha-metro venues and plausible tip-off times, so the format can be explored
now. Every screen is labeled as provisional. When FIBA publishes the real draw and
schedule, the team lists, fixtures and venues are replaced; the format engine does
not change.

## The format, and why it shapes the app

32 teams, played in three phases. This is unlike any other viewer in this family:

- **First round:** eight groups (A-H) of four, round-robin. The **top two of each
  group advance**; the bottom two drop to the 17th-32nd classification.
- **Second round:** four groups (I-L) of four, formed by merging pairs of
  first-round groups (**A&B → I, C&D → J, E&F → K, G&H → L**). The two
  co-qualifiers' first-round game **carries over** and counts again, so each team
  plays only two new games and a second-round group is a four-team round-robin whose
  six games span two rounds. The **top two of each advance** to the knockout.
- **Knockout:** a balanced eight-team bracket, quarter-finals to Final, plus a
  third-place game. The second-round groups **cross I↔L and J↔K**, so a group's
  winner and runner-up can only meet again in the Final.

**FIBA's points are not football's.** A win is 2 points and **a loss is 1**; only a
forfeit scores 0. And head-to-head is the *first* tie-breaker, ahead of overall
point difference.

The classification games (17th-32nd and 5th-8th) are in the schedule for
completeness but are not bracketed: the engine ranks the top 16 seriously.

## Features

- **Your timezone** — tip-off times auto-convert to your detected timezone. Every
  game is in the Doha metropolitan area, which is on Asia/Qatar (UTC+03:00) with no
  daylight saving, so the tournament has one venue clock.
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

Two sources, one authority:

| Source | Owns |
| --- | --- |
| **FIBA's format** (frozen in `scripts/official.mjs`) | Structure: the group and bracket wiring, and (until the real draw) the placeholder field, fixtures and tip-off times. |
| **ESPN's `basketball/fiba` scoreboard** | Event ids, arenas, and the score once a game is played (once the 2027 tournament is live). |

The placeholder data is generated with:

```bash
npm run build:data              # write src/data/{games,teams,venues}.js from official.mjs
```

Once the real draw is published, `scripts/official.mjs` is filled with the real
schedule and `npm run fetch:tournament` (the ESPN-overlay pipeline) takes over as
the live builder.

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

1. **The two-stage carryover in `src/utils/qualification.js` and
   `src/utils/secondRound.js`.** A second-round group is ranked by the games played
   *among its four members*, which is what picks up the carried-over first-round
   game automatically. Do not reintroduce a stage filter that drops it.
2. **The knockout crossover in `src/utils/bracket.js`.** I↔L and J↔K, verified
   against the 2023 tournament and used as the default until FIBA publishes the 2027
   bracket. Do not "tidy" it into a neater but wrong I-vs-J / K-vs-L.
3. **`site.web.api.espn.com`, not `site.api.espn.com`.** The two serve identical
   routes, but `site.api` returns 403 to datacenter IPs, which is every CI runner
   and every Netlify function.
4. **The placeholder labeling.** The draw is not real yet; the app says so
   everywhere. Do not remove the provisional notes while the field is illustrative.

## Credits

An unofficial fan-made project. Not affiliated with, endorsed by, or sponsored by
FIBA. "FIBA Basketball World Cup", team, broadcaster and tournament names are
trademarks of their respective owners. Schedule and results data compiled from
[FIBA](https://www.fiba.basketball/) and [ESPN](https://www.espn.com/). The app
icon (a basketball on the app's dark ground with a Qatar-maroon base) and the
social card use [Google Noto Emoji](https://github.com/googlefonts/noto-emoji)
(Apache License 2.0).

Created by [Chester Ismay](https://github.com/ismayc) · MIT licensed.
