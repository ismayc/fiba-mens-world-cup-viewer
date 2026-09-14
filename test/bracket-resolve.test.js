// Bracket resolution: filling slot labels with real teams as results land, across
// the two-stage-plus-knockout structure.
//
// The headline test is the full-tournament simulation: play every game and assert
// the second round and knockout resolve end to end with no 1-16 slot left as a
// placeholder.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  decideGame,
  resolveBracket,
  resolveKnockoutSlots,
  resolvePlacingSlots,
} from '../src/utils/bracketResolve.js'
import { FLAG_BY_TEAM } from '../src/data/teams.js'
import { playStage, playWholeTournament } from './helpers/tournament.js'

const num = (games, n) => games.find((g) => g.num === n)
const afterR1 = playStage('R1', GAMES)

describe('decideGame', () => {
  it('names the winner and loser of a finished game', () => {
    expect(decideGame({ t1: 'United States', t2: 'Serbia', score: [80, 70] })).toEqual({
      winner: 'United States',
      loser: 'Serbia',
    })
    expect(decideGame({ t1: 'United States', t2: 'Serbia', score: [70, 80] })).toEqual({
      winner: 'Serbia',
      loser: 'United States',
    })
  })

  it('decides an overtime game from the final score, with no shootout branch', () => {
    expect(decideGame({ t1: 'United States', t2: 'Serbia', score: [95, 92], ot: 1 }).winner).toBe(
      'United States',
    )
  })

  it('decides nothing for an unplayed, live or voided game', () => {
    expect(decideGame({ t1: 'United States', t2: 'Serbia' })).toBeNull()
    expect(decideGame({ t1: 'United States', t2: 'Serbia', score: [80, 70], live: {} })).toBeNull()
    expect(decideGame({ t1: 'United States', t2: 'Serbia', score: [80, 70], voided: true })).toBeNull()
  })

  it('refuses to invent a winner from a level score', () => {
    expect(decideGame({ t1: 'United States', t2: 'Serbia', score: [80, 80] })).toBeNull()
  })
})

describe('resolving the group-fed rounds', () => {
  it('fills second-round games from the finished first-round tables', () => {
    const out = resolvePlacingSlots(afterR1, ['R2'])
    for (const g of out.filter((x) => x.stage === 'R2')) {
      expect(FLAG_BY_TEAM[g.t1], `game ${g.num} side 1`).toBeTruthy()
      expect(FLAG_BY_TEAM[g.t2], `game ${g.num} side 2`).toBeTruthy()
    }
    // Game 49 is Group I's "Winner Group B" v "2nd Group A" -> Serbia v Dominican Republic.
    const g49 = out.find((x) => x.num === 49)
    expect([g49.t1, g49.t2]).toContain('Serbia')
    expect([g49.t1, g49.t2]).toContain('Dominican Republic')
  })

  it('leaves a second-round game a placeholder while its first-round group is unfinished', () => {
    // Nothing played: no first-round group is complete.
    const out = resolvePlacingSlots(GAMES, ['R2'])
    for (const g of out.filter((x) => x.stage === 'R2')) {
      expect(g.t1).toBeNull()
      expect(g.t2).toBeNull()
    }
  })

  it('fills the quarter-finals from the finished second-round tables', () => {
    const afterR2 = playStage('R2', resolvePlacingSlots(afterR1, ['R2']))
    const out = resolvePlacingSlots(afterR2, ['QF'])
    for (const g of out.filter((x) => x.stage === 'QF')) {
      expect(FLAG_BY_TEAM[g.t1]).toBeTruthy()
      expect(FLAG_BY_TEAM[g.t2]).toBeTruthy()
    }
  })

  it('keeps the label alongside a resolved team', () => {
    const out = resolvePlacingSlots(afterR1, ['R2'])
    const g49 = out.find((x) => x.num === 49)
    expect(g49.label1).toBe('Winner Group B')
    expect(FLAG_BY_TEAM[g49.t1]).toBeTruthy()
  })
})

describe('resolveKnockoutSlots', () => {
  it('carries a quarter-final winner into the semi it feeds', () => {
    const withQf = GAMES.map((g) =>
      g.num === 85 ? { ...g, t1: 'United States', t2: 'Serbia', score: [80, 70] } : g,
    )
    // Game 89 is "Winner Game 85" v "Winner Game 87".
    expect(num(resolveKnockoutSlots(withQf), 89).t1).toBe('United States')
  })

  it('waits for both sides before deciding, so a loser slot is never guessed', () => {
    const partial = GAMES.map((g) => (g.num === 89 ? { ...g, t1: 'United States' } : g))
    const out = resolveKnockoutSlots(partial)
    expect(num(out, 92).t1).toBeNull()
    expect(num(out, 91).t1).toBeNull()
  })

  it('fills the third-place game from the beaten semi-finalists', () => {
    const board = GAMES.map((g) => {
      if (g.num === 89) return { ...g, t1: 'United States', t2: 'Germany', score: [90, 80] }
      if (g.num === 90) return { ...g, t1: 'Serbia', t2: 'Canada', score: [70, 75] }
      return g
    })
    const out = resolveKnockoutSlots(board)
    expect(num(out, 91).t1).toBe('Germany') // loser of 89
    expect(num(out, 91).t2).toBe('Serbia') // loser of 90
    expect(num(out, 92).t1).toBe('United States')
    expect(num(out, 92).t2).toBe('Canada')
  })

  it('treats a level knockout score as undecided', () => {
    const board = GAMES.map((g) =>
      g.num === 85 ? { ...g, t1: 'United States', t2: 'Serbia', score: [80, 80] } : g,
    )
    expect(num(resolveKnockoutSlots(board), 89).t1).toBeNull()
  })

  it('leaves a slot alone when its label is missing entirely', () => {
    const board = GAMES.map((g) => (g.num === 89 ? { ...g, label1: null } : g))
    expect(num(resolveKnockoutSlots(board), 89).t1).toBeNull()
  })

  it('never rewrites a group-stage or classification game', () => {
    const out = resolveKnockoutSlots(GAMES)
    for (const g of out.filter((x) => ['R1', 'R2', 'Class'].includes(x.stage))) {
      expect(g).toBe(GAMES.find((x) => x.num === g.num))
    }
  })
})

describe('the full pipeline', () => {
  it('never resolves a classification game', () => {
    const out = resolveBracket(playWholeTournament(GAMES))
    for (const g of out.filter((x) => x.stage === 'Class')) {
      expect(g.t1).toBeNull()
      expect(g.t2).toBeNull()
    }
  })

  // End to end: play everything and require a champion with the whole 1-16 path
  // resolved and coherent.
  it('reconstructs the tournament with every 1-16 slot resolved', () => {
    // playWholeTournament stops after the semis (the Final and third-place game
    // are seeded but unplayed); play those two to crown a champion.
    let board = playWholeTournament(GAMES)
    board = playStage('Final', playStage('3rd', board))

    for (const g of board.filter((x) => ['R1', 'R2', 'QF', 'SF', '3rd', 'Final'].includes(x.stage))) {
      expect(FLAG_BY_TEAM[g.t1], `game ${g.num} side 1 unresolved`).toBeTruthy()
      expect(FLAG_BY_TEAM[g.t2], `game ${g.num} side 2 unresolved`).toBeTruthy()
    }

    const final = num(board, 92)
    const champion = final.score[0] > final.score[1] ? final.t1 : final.t2
    expect(FLAG_BY_TEAM[champion]).toBeTruthy()

    // The champion played a coherent route: a QF, an SF and the Final, never 3rd.
    const played = board.filter(
      (g) => ['QF', 'SF', '3rd', 'Final'].includes(g.stage) && (g.t1 === champion || g.t2 === champion),
    )
    const stages = played.map((g) => g.stage)
    expect(stages).toContain('QF')
    expect(stages).toContain('SF')
    expect(stages).toContain('Final')
    expect(stages).not.toContain('3rd')

    // The two beaten semi-finalists, and only they, contest third place.
    const third = num(board, 91)
    const semiLosers = [num(board, 89), num(board, 90)].map((g) =>
      g.score[0] > g.score[1] ? g.t2 : g.t1,
    )
    expect([third.t1, third.t2].sort()).toEqual([...semiLosers].sort())

    // Nobody appears twice in the same knockout round.
    for (const stage of ['QF', 'SF']) {
      const teams = board.filter((g) => g.stage === stage).flatMap((g) => [g.t1, g.t2])
      expect(new Set(teams).size).toBe(teams.length)
    }
  })

  it('sends exactly sixteen teams into the second round and eight into the knockout', () => {
    const afterR2 = playStage('R2', resolveBracket(afterR1))
    const r2Teams = new Set(
      resolveBracket(afterR1).filter((g) => g.stage === 'R2').flatMap((g) => [g.t1, g.t2]),
    )
    expect(r2Teams.size).toBe(16)
    const koTeams = new Set(
      resolveBracket(afterR2).filter((g) => g.stage === 'QF').flatMap((g) => [g.t1, g.t2]),
    )
    expect(koTeams.size).toBe(8)
  })
})
