import { describe, it, expect } from 'vitest'
import { parseScoreboard } from '../netlify/functions/calendar.js'

// ESPN files this competition's group headlines with a straight apostrophe (U+0027)
// and its knockout headlines with a curly one (U+2019): "FIBA Men's World Cup -
// Group C" but "FIBA Men’s World Cup - Quarter-finals". A headline filter that
// matched only the straight form silently dropped every game from the round that
// switched to the curly one (this bit the women's edition on its final day). This
// checks the men's calendar feed keeps BOTH, behaviorally, and drops a FIBA event
// that is not a World Cup.
const event = (headline) => ({
  events: [
    {
      id: 'x',
      date: '2027-08-27T11:00Z',
      competitions: [
        {
          notes: [{ headline }],
          status: { type: {} },
          venue: { fullName: 'Lusail Sports Arena', address: { city: 'Lusail' } },
          competitors: [
            { homeAway: 'home', team: { displayName: 'Nigeria' } },
            { homeAway: 'away', team: { displayName: 'United States' } },
          ],
        },
      ],
    },
  ],
})

describe('the ESPN scoreboard headline filter', () => {
  it('keeps a headline with the straight apostrophe', () => {
    expect(parseScoreboard(event("FIBA Men's World Cup - Group C"))).toHaveLength(1)
  })

  it('keeps a headline with the curly apostrophe', () => {
    expect(parseScoreboard(event('FIBA Men’s World Cup - Quarter-finals'))).toHaveLength(1)
  })

  it('drops a FIBA event that is not a World Cup', () => {
    expect(parseScoreboard(event('FIBA AmeriCup 2028 - Group A'))).toHaveLength(0)
  })
})
