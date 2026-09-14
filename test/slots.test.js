// The slot-label grammar: how a game's stage reads, how a placeholder parses, and
// which round the group phase feeds.

import { describe, it, expect } from 'vitest'
import { GAMES } from './fixtures/pretournament-games.js'
import {
  ENTRY_ROUND,
  GROUP_CLASS,
  WINNER_GROUP,
  SECOND_GROUP,
  WINNER_GAME,
  LOSER_GAME,
  FEED_LABEL,
  enteredAt,
  groupFedGames,
  groupPlacing,
  sideNames,
  slotLabels,
  stageLabel,
} from '../src/utils/slots.js'

const byNum = (n) => GAMES.find((g) => g.num === n)

describe('stageLabel', () => {
  it('reads a group-stage game as its group, both stages', () => {
    expect(stageLabel({ stage: 'R1', group: 'A' })).toBe('Group A')
    expect(stageLabel({ stage: 'R2', group: 'I' })).toBe('Group I')
  })

  it('reads a classification game by its own label, with a fallback', () => {
    expect(stageLabel({ stage: 'Class', classLabel: '17th–32nd classification' })).toBe(
      '17th–32nd classification',
    )
    expect(stageLabel({ stage: 'Class' })).toBe('Classification')
  })

  it('reads a knockout game from the stage table', () => {
    expect(stageLabel({ stage: 'QF' })).toBe('Quarter-Final')
    expect(stageLabel({ stage: 'Final' })).toBe('Final')
  })
})

describe('the group placing grammar', () => {
  it('covers both stages of groups in the character class', () => {
    expect(GROUP_CLASS).toBe('[ABCDEFGHIJKL]')
  })

  it('parses a winner and a runner-up, for a first- or second-round group', () => {
    expect(groupPlacing('Winner Group A')).toEqual({ group: 'A', place: 1 })
    expect(groupPlacing('2nd Group B')).toEqual({ group: 'B', place: 2 })
    expect(groupPlacing('Winner Group I')).toEqual({ group: 'I', place: 1 })
    expect(groupPlacing('2nd Group L')).toEqual({ group: 'L', place: 2 })
  })

  it('refuses a feed label, a real team, and a group this edition lacks', () => {
    expect(groupPlacing('Winner Game 85')).toBeNull()
    expect(groupPlacing('United States')).toBeNull()
    expect(groupPlacing('Winner Group Z')).toBeNull()
    expect(groupPlacing('Winner Group M')).toBeNull() // M is a classification group, not bracketed
  })

  it('exposes matching regexes', () => {
    expect(WINNER_GROUP.test('Winner Group J')).toBe(true)
    expect(SECOND_GROUP.test('2nd Group K')).toBe(true)
    expect(WINNER_GAME.exec('Winner Game 89')[1]).toBe('89')
    expect(LOSER_GAME.exec('Loser Game 90')[1]).toBe('90')
    expect(FEED_LABEL.test('Loser Game 91')).toBe(true)
    expect(FEED_LABEL.test('Winner Group A')).toBe(false)
  })
})

describe('reading a game’s sides', () => {
  it('slotLabels returns the labels, falling back to teams', () => {
    expect(slotLabels(byNum(85))).toEqual(['Winner Group I', '2nd Group L'])
    expect(slotLabels({ t1: 'United States', t2: 'Serbia' })).toEqual([
      'United States', 'Serbia',
    ])
  })

  it('sideNames prefers the resolved team, then the label, then empty', () => {
    expect(sideNames(byNum(85))).toEqual(['Winner Group I', '2nd Group L'])
    expect(sideNames({ t1: 'United States', label1: 'Winner Group I', t2: 'Serbia', label2: '2nd Group L' })).toEqual([
      'United States', 'Serbia',
    ])
    expect(sideNames({})).toEqual(['', ''])
  })
})

describe('the group-fed round', () => {
  it('is the quarter-finals, and only they are group-fed', () => {
    expect(ENTRY_ROUND).toBe('QF')
    expect(groupFedGames(GAMES).map((g) => g.num)).toEqual([85, 86, 87, 88])
  })

  it('enters both top-two placings at the quarter-finals, and nowhere for the rest', () => {
    expect(enteredAt(1)).toBe('QF')
    expect(enteredAt(2)).toBe('QF')
    expect(enteredAt(3)).toBeNull()
    expect(enteredAt(4)).toBeNull()
  })
})
