---
name: drive-app
description: Build, launch, and drive the FIBA Men's World Cup viewer app to verify a change end-to-end in a real browser.
---

# Verifying changes in the running app

Every selector, count, and string below was probed against THIS app on October 1,
2026 (headless Chrome, 1280x900). Until then this file was a byte-identical copy of
the women's FIBA viewer's skill, which describes an unplayed 2026 tournament. This
app holds the **completed 2023 tournament**: all 92 games are scored and frozen in
`src/data/games.js`, so nothing here is "pre-tournament". If something below does
not resolve, re-probe and fix this file rather than working around it.

## Launch

```bash
npx vite --port 5299 --strictPort &   # app at http://localhost:5299/
```

Use your own port, not the shared :5173 (every viewer in the family defaults to it
and they share localStorage there). `base: './'` in vite.config.js, so the app serves
at the root path with no repo prefix. Stop the server when done.

## Drive (headless browser)

Install `playwright-core` without a browser download into a scratch folder, and launch
the installed Google Chrome headless. It runs its own throwaway profile and never
touches a real Chrome window.

```bash
cd <scratch> && npm init -y >/dev/null && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -s playwright-core
```

```js
import { chromium } from 'playwright-core'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
```

## Stub the live feed

The app still polls ESPN on load: today's ±1 day window plus the 2023 tournament
dates, on **`site.web.api.espn.com`** (not `site.api`; routing the latter stubs
nothing). Stub it for deterministic runs:

```js
await page.route('**/site.web.api.espn.com/**', (r) => r.fulfill({ json: { events: [] } }))
```

On October 1, 2026, every check below gave the same result stubbed and unstubbed.

## You cannot simulate results here

`applyLive` in `src/services/espn.js` keeps any committed score ("the generated
schedule wins"), and every game has one. A doctored scoreboard can at most attach an
`espnId`, which the detail modal uses to fetch a box score. The overlay matches by
team pair, because every committed `espnId` is `null`. To test engine behavior on
partial results, use the test helpers (`test/helpers/tournament.js`, `playStage`,
`withGroupScores`) against `test/fixtures/pretournament-games.js`, not the browser.

## Selectors that work

**Shell, any view**
- `.app-header`, `.subtitle` (reads "92 games, 25 August–10 September · Philippines ·
  Japan · Indonesia · Times in America/Phoenix"), `.app-footer`
- `.champ-banner` reads "👑 🇩🇪 Germany are the 2023 FIBA World Cup champions! 🏆"
  (with 18 `.confetti` elements).
- `.view-bar`, `.view-btn`, `.view-btn.active`: **four** tabs, `📋 Schedule`,
  `📆 Week`, `📊 Groups`, `🏆 Bracket`. Scenarios is `groupStageOnly` and is hidden
  once the tournament is archived. Match on the word
  (`page.locator('.view-btn', { hasText: 'Groups' })`), not the emoji.
- `.results-bar.results-ok`: "92 games with scores … live via ESPN".
- `.spoiler-btn`: "👁 Scores shown"; clicking it flips to "🙈 Scores hidden" and
  replaces each card's score with "🙈 tap to reveal".
- `.view-strip`: absent on load, present after scrolling ~2500px.

**Schedule.** The list opens almost empty, deliberately:
- Each finished stage is held back behind a `.schedule-note` ("First round complete
  — 48 first-round games hidden.") with a `.linklike` "Show first-round games"
  button. There are five notes (first round 48, second round 16, classification 20,
  quarter-finals 4, semi-finals 2). Clicking one adds that stage to the stage filter,
  after which the other notes disappear and the list shows only the selected stages.
- So a clean load shows only the last day (`Sunday, September 10, 2023`, 2 games:
  Third-Place Game and Final), as one collapsed `.day-header`. `.card` is 0 until a
  `.day-header` (a `.day-toggle`) is clicked.
- `.pastdays-btn` reads "▾Hide past days" and starts with past days SHOWN. Every
  day is in the past, so clicking it empties the schedule. It is not a reveal button.
- **All 92 cards:** open `⚙ Filters & Search` (`.filters-toggle`), click every
  `.stage-chips button` (`.stage-chip`, `.stage-chip.active` when on: First Round,
  Second Round, Classification, Quarter-Final, Semi-Final, Third-Place Game, Final),
  then click all 16 `.day-header`s.
- Card parts: `.card-head`, `.card-body`, `.card-actions`, `.card-time`, `.card-tv`,
  `.tv-badge`, `.venue`. A card's buttons are `☆` (one per team),
  `📺 How to watch (US) ▼`, `＋ Add to calendar`, and `ℹ Details`. Find a game by
  its number: `page.locator('.card').filter({ hasText: 'Game 92' })` is the Final,
  Germany 83–77 Serbia.

**Game detail modal** (`button:has-text("Details")`): `.md-overlay`, `.md-card`,
`.md-close`, `.md-head`, `.md-stage`, `.md-teams`, `.md-team` (2), `.md-flag`,
`.md-name`, `.md-score`, `.md-meta`, `.md-section` ("Going into this game" with a
`.md-tape` comparison, then "How to watch (US)"), `.md-watch`, `.md-lang`,
`.md-cal`. Escape closes it. There is no `.md-title`, `.md-body`, or `.modal`.

**Groups (standings):** `.groups-view`, two `.stage-heading`s ("First round",
"Second round"), two `.standings-grid`s, 12 `.group-card` / `.standings-table` in
order A to L (`.group-title-btn` reads "Group A"), `.standings-legend`,
`.standings-tip`, `.standings-toolbar`, `.ais-toggle`, `.col-team`, `.col-pts`,
`.col-finish`, `.finish.finish-locked` (every Finish is a single locked number),
`.q-badge` (`🥇 Won group`, `✅ Advanced`, `❌ Eliminated`), `.as-it-stands` (12).
`.tiebreak-mark` is 0. Read a group's order with `.standings-table` → `tbody tr` →
`.col-team`. Group A finishes Dominican Republic, Italy, Angola, Philippines;
Group I finishes Italy, Serbia, Puerto Rico, Dominican Republic.

**Bracket:** `.bracket-view`, `.bracket-hint`, `.path-picker` with a `.path-select`
(the eight quarter-finalists), `.bracket`, `.bx-half-left` / `.bx-half-right`,
`.bx-col` (5; heads Quarter-Final, Semi-Final, 🏆 Final, Semi-Final, Quarter-Final),
`.bx-match` (8: four QF, two SF, Final, third place), `.bx-side` (16, each with a
`.bx-team`), `.bx-score`, `.bx-flag`, `.bx-venue`, `.bx-col-final`,
`.bx-third-label`. The quarter-finals cross **I↔J and K↔L** (game 85 is Italy, Winner
Group I, against the United States, 2nd Group J). On a phone width the bracket is
`MobileBracket` instead, which these selectors do not cover.

**Week:** `.week-view`, `.week-nav`, `.week-arrow` (2), `.week-title`, `.week-grid`,
`.week-col` (7), `.week-day-btn`, `.week-cell`, `.wc-team`, `.wc-stage`,
`.wc-venue`, `.week-legend`.

**Filters and search** (Schedule only): `⚙ Filters & Search` (`.filters-toggle`)
reveals `.filters`, `.stage-chips`, `.search-toggle`, and the selects (timezone among
them). The search box appears only after clicking `.search-toggle`; it is
`input.search[type=search]`, so its ARIA role is **searchbox, not textbox**.

**Calendar modal:** `📤 Calendar` → `.cal-modal`, `.cal-title`, `.cal-row`,
`.cal-btn-primary`. Select it with `button:has-text("📤 Calendar")`: a bare
`hasText: 'Calendar'` also matches every card's `＋ Add to calendar`.

**My services modal:** `📺 Choose my services` → `.svc-modal`, `.svc-list`,
`.svc-name` (8), `.svc-foot`.

## Gotchas

- **Rendering is time-of-day sensitive** (local times, "today" for past days). Card
  times above are America/Phoenix; don't assert exact times.
- **Don't assert with loose attribute globs.** `[class*="active"]` also matches
  `view-btn active` and `stage-chip active`. Target the specific class.
- `innerText` returns null on SVG `<text>`; use `.textContent()` and confirm with
  `.isVisible()` / `.boundingBox()`.
