// The "decided by a drawing of lots" marker: shown only when two adjacent teams
// are level on every computable criterion.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import { TEAMS } from '../src/data/teams.js'
import { softTiebreaks, TIEBREAK_LABEL } from '../src/utils/tiebreakNotes.js'
import { withGroupScores } from './helpers/tournament.js'

const A = (results) => withGroupScores('A', results, GAMES)

describe('softTiebreaks', () => {
  it('marks nothing before anything is played', () => {
    // Four teams on zero are trivially level; marking that would put a ⚖ on every
    // row of every group and train the reader to ignore the marker.
    expect(softTiebreaks(TEAMS.A, GAMES).size).toBe(0)
  })

  it('marks a block that only a drawing of lots could separate', () => {
    // Italy, Dominican Republic and Philippines form a 2-1 cycle with the same
    // margin, and each beats Angola by the same margin, so nothing computable
    // separates them.
    const board = A([
      ['Italy', 'Dominican Republic', 80, 70],
      ['Dominican Republic', 'Philippines', 80, 70],
      ['Philippines', 'Italy', 80, 70],
      ['Italy', 'Angola', 90, 60],
      ['Angola', 'Dominican Republic', 60, 90],
      ['Philippines', 'Angola', 90, 60],
    ])
    const notes = softTiebreaks(TEAMS.A, board)
    expect(notes.size).toBeGreaterThan(0)
    for (const n of notes.values()) expect(n.reason).toBe('lots')
  })

  it('does NOT mark a points-level pair that head-to-head separates', () => {
    // Italy and Dominican Republic both finish 2-1, but Dominican Republic won the
    // game between them, so the tie is broken on the court, not by lots.
    const board = A([
      ['Italy', 'Dominican Republic', 70, 80], // Dominican Republic win the head-to-head
      ['Italy', 'Philippines', 90, 60],
      ['Italy', 'Angola', 90, 60],
      ['Dominican Republic', 'Philippines', 90, 60],
      ['Dominican Republic', 'Angola', 90, 60],
      ['Philippines', 'Angola', 90, 60],
    ])
    // Italy and Dominican Republic are level on 5 points; the head-to-head splits
    // them, so neither is marked as lots.
    const notes = softTiebreaks(TEAMS.A, board)
    expect(notes.has('Italy')).toBe(false)
    expect(notes.has('Dominican Republic')).toBe(false)
  })
})

describe('TIEBREAK_LABEL', () => {
  it('knows only ONE soft reason, because FIBA has no fair-play criterion', () => {
    expect(Object.keys(TIEBREAK_LABEL)).toEqual(['lots'])
    expect(TIEBREAK_LABEL.lots).toMatch(/lots/)
  })
})
