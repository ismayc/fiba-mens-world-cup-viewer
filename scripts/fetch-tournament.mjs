// Regenerate src/data/{games,teams,venues}.js.
//
// PLACEHOLDER ERA. The 2027 draw has not been held and ESPN carries no men's
// tournament data yet, so there is nothing to overlay: this simply rebuilds the
// committed board from the frozen authority (scripts/official.mjs) via
// scripts/build-data.mjs. It is what `npm run fetch:tournament` and the refresh
// workflow call, so they keep working, but during the placeholder era it is
// equivalent to `npm run build:data`.
//
// When FIBA publishes the real 2027 draw and schedule, scripts/official.mjs is
// filled with the real fixtures and this file is restored to the full pipeline
// that merges the official schedule with ESPN's live scoreboard (event ids,
// arenas, scores), the way the fiba-womens-world-cup-viewer sibling does it.
//
// Node built-ins and in-repo source only, like every script here.

import './build-data.mjs'
