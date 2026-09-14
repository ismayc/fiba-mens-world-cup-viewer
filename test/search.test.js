// Scoped search: parse `team: Japan arena: Lusail` into field filters plus free
// text, and match a game against them.

import { describe, it, expect } from 'vitest'
import { STAGE_ORDER } from '../src/data/games.js'
import { GAMES } from './fixtures/pretournament-games.js'
import { matchesSearch, parseQuery } from '../src/utils/search.js'
import { venueFor } from '../src/utils/venue.js'

const run = (query) => GAMES.filter((g) => matchesSearch(g, venueFor(g), parseQuery(query)))
const G1 = GAMES[0] // United States v Nigeria, Lusail Sports Arena
const V1 = venueFor(G1)

describe('parseQuery', () => {
  it('reads a bare query as free text', () => {
    expect(parseQuery('nigeria')).toEqual({ free: 'nigeria', tokens: [] })
    expect(parseQuery('')).toEqual({ free: '', tokens: [] })
    expect(parseQuery(undefined)).toEqual({ free: '', tokens: [] })
  })

  it('splits scoped fields from leading free text', () => {
    expect(parseQuery('lusail team: Serbia')).toEqual({
      free: 'lusail',
      tokens: [{ field: 'team', value: 'Serbia' }],
    })
  })

  it('reads several scoped fields in one query', () => {
    expect(parseQuery('team: Serbia stage: final').tokens).toEqual([
      { field: 'team', value: 'Serbia' },
      { field: 'stage', value: 'final' },
    ])
  })

  it('accepts each documented synonym for a field', () => {
    for (const key of ['team', 'teams', 't']) {
      expect(parseQuery(`${key}: Serbia`).tokens[0].field).toBe('team')
    }
    for (const key of ['arena', 'stadium', 'venue', 'ground']) {
      expect(parseQuery(`${key}: Lusail`).tokens[0].field).toBe('arena')
    }
    for (const key of ['group', 'grp', 'g']) {
      expect(parseQuery(`${key}: A`).tokens[0].field).toBe('group')
    }
    for (const key of ['stage', 'round']) {
      expect(parseQuery(`${key}: final`).tokens[0].field).toBe('stage')
    }
    for (const key of ['country', 'host']) {
      expect(parseQuery(`${key}: Qatar`).tokens[0].field).toBe('country')
    }
  })

  it('demotes an unknown field to free text', () => {
    expect(parseQuery('sport: basketball')).toEqual({ free: 'basketball', tokens: [] })
    expect(parseQuery('team: Serbia sport: basketball').free).toBe('basketball')
  })

  it('ignores a field with no value', () => {
    expect(parseQuery('team:').tokens).toEqual([])
  })
})

describe('scoped matching', () => {
  it('matches a team on either side', () => {
    expect(run('team: United States')).toHaveLength(3)
    expect(run('team: Nigeria').every((g) => g.t1 === 'Nigeria' || g.t2 === 'Nigeria')).toBe(true)
    expect(run('team: Narnia')).toHaveLength(0)
  })

  it('matches a first-round group exactly, with or without the word "group"', () => {
    expect(run('group: A')).toHaveLength(6)
    expect(run('group: group a')).toHaveLength(6)
    expect(run('group: AB')).toHaveLength(0)
  })

  it('matches the city and the country', () => {
    expect(run('country: Qatar')).toHaveLength(GAMES.length)
    expect(run('city: Lusail').length).toBeGreaterThan(0)
    expect(run('city: Sydney')).toHaveLength(0)
  })

  it('matches an arena by name', () => {
    expect(run('arena: Lusail').length).toBeGreaterThan(0)
    expect(run('arena: Al Attiyah').length).toBeGreaterThan(0)
    expect(run('arena: Wembley')).toHaveLength(0)
  })

  it('matches a stage by code, synonym and label', () => {
    expect(run('stage: final').every((g) => g.stage === 'Final')).toBe(true)
    expect(run('stage: qf')).toHaveLength(4)
    expect(run('stage: quarter-final')).toHaveLength(4)
    expect(run('stage: sf')).toHaveLength(2)
    expect(run('stage: third')).toHaveLength(1)
    expect(run('stage: bronze')).toHaveLength(1)
    // First round has several synonyms, "group" among them (the first round IS the
    // group stage), plus "first round".
    expect(run('stage: first round')).toHaveLength(48)
    expect(run('stage: group')).toHaveLength(48)
    expect(run('stage: second round')).toHaveLength(16)
    expect(run('stage: classification')).toHaveLength(20)
    // A word that is no synonym falls through to the printed label: a partial of
    // "Quarter-Final" still matches, pure nonsense matches nothing.
    expect(run('stage: quarter-fin')).toHaveLength(4)
    expect(run('stage: nonsense')).toHaveLength(0)
  })

  it('reaches every stage in STAGE_ORDER by a synonym or its label', () => {
    const byCode = {
      R1: 'first round',
      R2: 'second round',
      Class: 'classification',
      QF: 'qf',
      SF: 'sf',
      '3rd': 'third',
      Final: 'final',
    }
    expect(Object.keys(byCode).sort()).toEqual([...STAGE_ORDER].sort())
    for (const [code, syn] of Object.entries(byCode)) {
      const hits = run(`stage: ${syn}`)
      expect(hits.length, `stage: ${syn}`).toBeGreaterThan(0)
      expect(hits.every((g) => g.stage === code), `stage: ${syn}`).toBe(true)
    }
  })

  it('combines scoped fields with AND', () => {
    expect(run('team: United States group: A')).toHaveLength(3)
    expect(run('team: United States group: B')).toHaveLength(0)
  })
})

describe('free-text matching', () => {
  it('searches teams, arena, city, country, group and stage', () => {
    expect(matchesSearch(G1, V1, parseQuery('united states'))).toBe(true)
    expect(matchesSearch(G1, V1, parseQuery('lusail'))).toBe(true)
    expect(matchesSearch(G1, V1, parseQuery('qatar'))).toBe(true)
    expect(matchesSearch(G1, V1, parseQuery('group a'))).toBe(true)
    expect(matchesSearch(G1, V1, parseQuery('first round'))).toBe(true)
    expect(matchesSearch(G1, V1, parseQuery('australia'))).toBe(false)
  })

  // A knockout game has null teams, so the haystack falls back to the slot labels.
  it('searches a knockout game by its slot label', () => {
    const qf = GAMES.find((g) => g.num === 85)
    expect(matchesSearch(qf, venueFor(qf), parseQuery('winner group i'))).toBe(true)
    expect(matchesSearch(qf, venueFor(qf), parseQuery('quarter-final'))).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(run('')).toHaveLength(GAMES.length)
  })
})
