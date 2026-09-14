import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { LEAGUE } from '../src/config/league.js'

// One card once rendered "v" (football's separator) while others rendered "vs".
// Nothing caught it: each site is a different component and no test compares them.
// The home/away separator must come from LEAGUE.homeAwaySep, never be hardcoded.
//
// This walks every component for a <span> whose literal text is the separator WORD
// ("v" or "vs"). A span whose content is an interpolation ({LEAGUE.homeAwaySep})
// is fine, and so is a non-separator glyph such as the "→" that marks a projected
// destination — only a hardcoded home/away word is a bug.
const DIR = join(import.meta.dirname, '../src/components')
const SEP_WORDS = new Set(['v', 'vs'])

describe('the home/away separator', () => {
  it('is never hardcoded as a span’s text', () => {
    const found = []
    for (const f of readdirSync(DIR).filter((n) => n.endsWith('.jsx'))) {
      const src = readFileSync(join(DIR, f), 'utf8')
      for (const m of src.matchAll(/<span[^>]*>([^<{]+)<\/span>/g)) {
        if (SEP_WORDS.has(m[1].trim().toLowerCase())) found.push(`${f}: "${m[1].trim()}"`)
      }
    }
    expect(found, `hardcoded separators found: ${found.join(', ')}`).toEqual([])
  })

  it('comes from the config, which says what basketball uses', () => {
    expect(LEAGUE.homeAwaySep).toBe('vs')
  })
})
