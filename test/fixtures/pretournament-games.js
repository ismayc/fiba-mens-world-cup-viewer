// The pre-tournament board: all 92 games of the real 2023 tournament with every
// RESULT removed. First-round games keep the teams they were drawn with; the
// second-round, knockout and classification games revert to their seeding labels
// with null teams (as they stood before a ball was thrown); no game carries a score.
//
// Every test builder starts from HERE, never from src/data/games.js, so a test that
// means to overlay one group's results does not inherit the other 91 games' real
// outcomes. 2023 is history and will not change, so deriving this "nothing played"
// snapshot from the frozen authority (scripts/official.mjs) is stable.
//
// Synthetic `espnId`s are added so the live-overlay tests have ids to match; the
// real 2023 tournament has no live ESPN feed. `tv` is empty, matching the committed
// board.

import { officialGames } from '../../scripts/official.mjs'

export const GAMES = officialGames().map((g) => {
  const { score, ...rest } = g
  // First-round teams are known from the draw; every later game is a placeholder
  // (label1/label2) until the resolver fills it.
  const pre = g.stage === 'R1' ? rest : { ...rest, t1: null, t2: null }
  return { ...pre, espnId: String(401300000 + g.num), tv: [] }
})
