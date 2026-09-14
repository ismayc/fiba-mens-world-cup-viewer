// The FROZEN pre-tournament board: all 92 games, nothing played.
//
// Every test builder starts from HERE, never from src/data/games.js, which is
// regenerated during the tournament and would leak real results into a test that
// only meant to overlay one group. This board is derived from the frozen authority
// (scripts/official.mjs), which carries no scores, so it is a stable
// "nothing played yet" snapshot regardless of what the live feed has done.
//
// Synthetic `espnId`s are added here (the real 2027 event ids do not exist yet) so
// the live-overlay tests have ids to match against. `tv` is empty, matching the
// placeholder-era committed board.

import { officialGames } from '../../scripts/official.mjs'

export const GAMES = officialGames().map((g) => ({
  ...g,
  espnId: String(401300000 + g.num),
  tv: [],
}))
