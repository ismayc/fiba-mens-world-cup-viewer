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
    // US, Greece and Dominican Republic form a 2-1 cycle with the same margin, and
    // each beats Nigeria by the same margin, so nothing computable separates them.
    const board = A([
      ['United States', 'Greece', 80, 70],
      ['Greece', 'Dominican Republic', 80, 70],
      ['Dominican Republic', 'United States', 80, 70],
      ['United States', 'Nigeria', 90, 60],
      ['Nigeria', 'Greece', 60, 90],
      ['Dominican Republic', 'Nigeria', 90, 60],
    ])
    const notes = softTiebreaks(TEAMS.A, board)
    expect(notes.size).toBeGreaterThan(0)
    for (const n of notes.values()) expect(n.reason).toBe('lots')
  })

  it('does NOT mark a points-level pair that head-to-head separates', () => {
    // US and Greece both finish 2-1, but Greece won the game between them, so the
    // tie is broken on the court, not by lots.
    const board = A([
      ['United States', 'Greece', 70, 80], // Greece win the head-to-head
      ['United States', 'Dominican Republic', 90, 60],
      ['United States', 'Nigeria', 90, 60],
      ['Greece', 'Dominican Republic', 90, 60],
      ['Greece', 'Nigeria', 90, 60],
      ['Dominican Republic', 'Nigeria', 90, 60],
    ])
    // US and Greece are level on 5 points; the head-to-head splits them, so neither
    // is marked as lots.
    const notes = softTiebreaks(TEAMS.A, board)
    expect(notes.has('United States')).toBe(false)
    expect(notes.has('Greece')).toBe(false)
  })
})

describe('TIEBREAK_LABEL', () => {
  it('knows only ONE soft reason, because FIBA has no fair-play criterion', () => {
    expect(Object.keys(TIEBREAK_LABEL)).toEqual(['lots'])
    expect(TIEBREAK_LABEL.lots).toMatch(/lots/)
  })
})
