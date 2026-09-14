// Data-integrity tests. The committed schedule is the app's source of record, so
// these assert the SHAPE of the tournament against facts that are true of the real,
// completed 2023 edition and would break loudly if a regeneration went wrong.
//
// This is the real, finished 2023 tournament: the teams, groups, ranks and scores
// below are the actual qualifiers and results, not placeholders.

import { describe, it, expect } from 'vitest'
import { GAMES, STAGE_LABELS, STAGE_ORDER } from '../src/data/games.js'
import { TEAMS, FLAG_BY_TEAM, ABBR_BY_TEAM, ALL_TEAMS, RANK_BY_TEAM } from '../src/data/teams.js'
import { VENUES } from '../src/data/venues.js'
import { US_BROADCAST, OUTLET_NOTES, RIGHTS_HOLDER } from '../src/data/broadcast.js'

const R1_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const r1 = GAMES.filter((g) => g.stage === 'R1')
const nonR1 = GAMES.filter((g) => g.stage !== 'R1')

describe('tournament shape', () => {
  it('has 92 games: 48 first round + 16 second round + 20 classification + 8 knockout', () => {
    expect(GAMES).toHaveLength(92)
    const count = (s) => GAMES.filter((g) => g.stage === s).length
    expect(count('R1')).toBe(48)
    expect(count('R2')).toBe(16)
    expect(count('Class')).toBe(20)
    expect(count('QF')).toBe(4)
    expect(count('SF')).toBe(2)
    expect(count('3rd')).toBe(1)
    expect(count('Final')).toBe(1)
  })

  it('numbers games 1-92 with no gaps or duplicates', () => {
    expect(GAMES.map((g) => g.num).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 92 }, (_, i) => i + 1),
    )
  })

  it('gives every first-round group four teams and six games', () => {
    for (const g of R1_GROUPS) {
      const games = r1.filter((x) => x.group === g)
      expect(games).toHaveLength(6)
      expect(TEAMS[g]).toHaveLength(4)
      // Six games is exactly every pair of four teams meeting once.
      const pairs = new Set(games.map((x) => [x.t1, x.t2].sort().join('|')))
      expect(pairs.size).toBe(6)
      const names = new Set(games.flatMap((x) => [x.t1, x.t2]))
      expect([...names].sort()).toEqual(TEAMS[g].map((t) => t.name).sort())
    }
  })

  it('fields 32 teams, each in exactly one group', () => {
    expect(ALL_TEAMS).toHaveLength(32)
    const seen = new Set()
    for (const g of R1_GROUPS) {
      for (const t of TEAMS[g]) {
        expect(seen.has(t.name)).toBe(false)
        seen.add(t.name)
      }
    }
    expect(seen.size).toBe(32)
  })

  it('orders the stages as FIBA plays them', () => {
    expect(STAGE_ORDER).toEqual(['R1', 'R2', 'Class', 'QF', 'SF', '3rd', 'Final'])
    for (const s of STAGE_ORDER) expect(STAGE_LABELS[s]).toBeTruthy()
    for (const g of GAMES) expect(STAGE_ORDER).toContain(g.stage)
  })
})

describe('teams', () => {
  it('gives every team a flag and a three-letter abbreviation', () => {
    for (const name of ALL_TEAMS) {
      expect(FLAG_BY_TEAM[name]).toBeTruthy()
      expect(ABBR_BY_TEAM[name]).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('has no duplicate abbreviations at all', () => {
    const codes = ALL_TEAMS.map((n) => ABBR_BY_TEAM[n])
    expect(new Set(codes).size).toBe(codes.length)
  })

  // The ranking is FIBA's February 2023 world ranking, densely renumbered 1-32 over
  // the 32-team field. It must be distinct and total across all 32, or a still-level
  // group's order and the projected bracket become non-deterministic.
  it('gives every team a distinct rank from 1 to 32', () => {
    const ranks = ALL_TEAMS.map((n) => RANK_BY_TEAM[n])
    expect(new Set(ranks).size).toBe(32)
    expect(Math.min(...ranks)).toBe(1)
    expect(Math.max(...ranks)).toBe(32)
    expect(RANK_BY_TEAM.Spain).toBe(1)
    expect(RANK_BY_TEAM['United States']).toBe(2)
    expect(RANK_BY_TEAM['Cape Verde']).toBe(32)
  })

  it('lists each group strongest-first by rank, not alphabetically', () => {
    for (const g of R1_GROUPS) {
      const ranks = TEAMS[g].map((t) => t.rank)
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
      for (const t of TEAMS[g]) expect(t.rank).toBe(RANK_BY_TEAM[t.name])
    }
    // Group A is the sharp case: alphabetical would put Angola first, rank puts Italy.
    expect(TEAMS.A.map((t) => t.name)).toEqual([
      'Italy', 'Dominican Republic', 'Philippines', 'Angola',
    ])
  })
})

describe('venues and times', () => {
  it('plays across the three co-hosts and their timezones', () => {
    const countries = new Set(['Philippines', 'Japan', 'Indonesia'])
    const zones = new Set(['Asia/Manila', 'Asia/Tokyo', 'Asia/Jakarta'])
    for (const v of Object.values(VENUES)) {
      expect(countries.has(v.country), v.name).toBe(true)
      expect(zones.has(v.tz), v.name).toBe(true)
    }
    expect(Object.keys(VENUES)).toHaveLength(5)
    expect(new Set(Object.values(VENUES).map((v) => v.city))).toEqual(
      new Set(['Bocaue', 'Pasay', 'Quezon City', 'Okinawa', 'Jakarta']),
    )
  })

  it('names the host arenas', () => {
    expect(VENUES.philippinearena.name).toBe('Philippine Arena')
    expect(VENUES.moa.name).toBe('Mall of Asia Arena')
    expect(VENUES.araneta.name).toBe('Araneta Coliseum')
    expect(VENUES.okinawa.name).toBe('Okinawa Arena')
    expect(VENUES.jakarta.name).toBe('Indonesia Arena')
  })

  it('stores every game at its venue offset, inside the window', () => {
    for (const g of GAMES) {
      expect(g.ko, `game ${g.num}`).toMatch(/[+]0[789]:00$/)
      const t = new Date(g.ko)
      expect(t >= new Date('2023-08-25T00:00:00+08:00')).toBe(true)
      expect(t <= new Date('2023-09-10T23:59:59+08:00')).toBe(true)
    }
  })

  it('assigns every game a real arena', () => {
    for (const g of GAMES) expect(VENUES[g.venue]).toBeTruthy()
  })
})

describe('the generated board', () => {
  // src/data/games.js is regenerated by scripts/build-data.mjs; the banner has to
  // survive so a hand edit is not silently reverted.
  it('carries the generated do-not-edit banner', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'data', 'games.js'), 'utf8')
    expect(src).toMatch(/GENERATED by scripts\//)
    expect(src).toMatch(/do not edit by hand/)
  })

  it('records every game played, with a two-number score, no ESPN id and no broadcast', () => {
    for (const g of GAMES) {
      expect(Array.isArray(g.score), `game ${g.num}`).toBe(true)
      expect(g.score, `game ${g.num}`).toHaveLength(2)
      expect(g.espnId, `game ${g.num}`).toBeNull()
      expect(g.tv, `game ${g.num}`).toEqual([])
    }
  })

  it('gives first-round games real teams and a group', () => {
    for (const g of r1) {
      expect(ALL_TEAMS).toContain(g.t1)
      expect(ALL_TEAMS).toContain(g.t2)
      expect(g.t1).not.toBe(g.t2)
      expect(R1_GROUPS).toContain(g.group)
    }
  })

  it('carries slot labels alongside resolved teams on every non-first-round game', () => {
    for (const g of nonR1) {
      expect(g.label1, `game ${g.num}`).toBeTruthy()
      expect(g.label2, `game ${g.num}`).toBeTruthy()
      expect(ALL_TEAMS, `game ${g.num}`).toContain(g.t1)
      expect(ALL_TEAMS, `game ${g.num}`).toContain(g.t2)
    }
  })

  // Every label must be one the slot grammar can parse, or the bracket silently
  // fails to resolve that side.
  it('uses only labels the slot grammar understands', () => {
    const ok = /^(Winner Group [A-L]|2nd Group [A-L]|3rd Group [A-H]|4th Group [A-H]|Winner Game \d+|Loser Game \d+)$/
    for (const g of nonR1) {
      expect(g.label1, `game ${g.num}`).toMatch(ok)
      expect(g.label2, `game ${g.num}`).toMatch(ok)
    }
  })

  it('never records a level score, because basketball has no draw', () => {
    for (const g of GAMES) {
      if (Array.isArray(g.score)) expect(g.score[0]).not.toBe(g.score[1])
    }
  })
})

// US broadcast data is not set for this edition (a completed 2023 tournament has no
// live feed), so every game's `tv` is empty. The broadcast.js module is still the
// women's edition's WBD data, carried unchanged; these assert it imports and is
// well-formed so it stays covered, and are the reminder to replace it with the men's
// rights when known.
describe('US broadcast module (placeholder, pending men’s rights)', () => {
  it('exports a well-formed English coverage shape', () => {
    expect(Array.isArray(US_BROADCAST.english.tv)).toBe(true)
    expect(Array.isArray(US_BROADCAST.english.streaming)).toBe(true)
    expect(typeof RIGHTS_HOLDER).toBe('string')
  })

  it('attaches a note to every streamer it names', () => {
    for (const outlet of US_BROADCAST.english.streaming) {
      expect(OUTLET_NOTES[outlet], outlet).toBeTruthy()
    }
  })
})
