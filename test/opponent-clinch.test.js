// Knockout opponent clinch: a quarter-final opponent locks once BOTH second-round
// placings are pinned exactly (the team's own, and the crossover placing).

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import { lockedOpponent } from '../src/utils/opponentClinch.js'
import { rankSecondRound } from '../src/utils/secondRound.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { playStage } from './helpers/tournament.js'

const afterR1 = playStage('R1', GAMES)
const afterR2 = playStage('R2', resolveBracket(afterR1))

describe('when the whole second round is decided', () => {
  it('locks the quarter-final opponent, and it is symmetric', () => {
    const winnerI = rankSecondRound('I', afterR2)[0].name // plays game 85 (Winner Group I)
    const lock = lockedOpponent(afterR2, winnerI)
    expect(lock).not.toBeNull()
    expect(lock.gameNum).toBe(85)
    expect(lock.round).toBe('QF')
    // Asking from the other side returns the original team.
    const back = lockedOpponent(afterR2, lock.opponent)
    expect(back.gameNum).toBe(85)
    expect(back.opponent).toBe(winnerI)
  })

  it('locks nothing for a team that did not reach the knockout', () => {
    const thirdI = rankSecondRound('I', afterR2)[2].name // finishes 3rd, out
    expect(lockedOpponent(afterR2, thirdI)).toBeNull()
  })
})

describe('when placings are not yet pinned', () => {
  it('locks nothing before the second round is seeded', () => {
    expect(lockedOpponent(GAMES, 'United States')).toBeNull()
  })

  it('locks nothing while the second-round table is unplayed', () => {
    // Seeded but no second-round game played: placings are not pinned.
    const winnerSoFar = rankSecondRound('I', afterR1)[0].name
    expect(lockedOpponent(afterR1, winnerSoFar)).toBeNull()
  })

  it('locks nothing while the OPPOSING group is still open', () => {
    // Play only group I's second-round games: I is decided, its crossover group L
    // is not, so I's winner has a game but no locked opponent.
    const onlyI = afterR1.map((g) =>
      g.stage === 'R2' && g.group === 'I'
        ? { ...resolveBracket(afterR1).find((x) => x.num === g.num), score: [90, 70] }
        : g,
    )
    const winnerI = rankSecondRound('I', onlyI)[0].name
    expect(lockedOpponent(onlyI, winnerI)).toBeNull()
  })

  it('locks nothing when the crossover group is not even seeded', () => {
    // Play the first round for groups A and B only, then group I's second-round
    // games. Group I is complete (so its winner's place is pinned), but the
    // crossover group L is never seeded because G and H have not played — so the
    // opponent slot cannot resolve at all.
    const abOnly = GAMES.map((g) =>
      g.stage === 'R1' && (g.group === 'A' || g.group === 'B') ? { ...g, score: [90, 70] } : g,
    )
    const seeded = resolveBracket(abOnly)
    const iDone = seeded.map((g) =>
      g.stage === 'R2' && g.group === 'I' ? { ...g, score: [90, 70] } : g,
    )
    const winnerI = rankSecondRound('I', iDone)[0].name
    expect(rankSecondRound('L', iDone)).toBeNull() // L never seeded
    expect(lockedOpponent(iDone, winnerI)).toBeNull()
  })
})
