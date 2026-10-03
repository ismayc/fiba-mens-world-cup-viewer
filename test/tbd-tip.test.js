import { describe, it, expect, vi } from 'vitest'
import { fetchLive, applyLive } from '../src/services/espn.js'

// A TIP-OFF ESPN HAS NOT ANNOUNCED.
//
// This viewer already models an unknown tip honestly: FIBA announces the final-phase
// times only as the rounds resolve, so those games are committed with `ko: null` and
// `tbdTip: true`, and everything time-shaped tolerates that.
//
// The hole was the upgrade path. ESPN marks an unset time with `timeValid: false` and
// sends midnight US Eastern in place of it, and the overlay treated any instant as a
// published tip — so the first ESPN record for such a game REPLACED an honest "to be
// confirmed" with a time nobody announced, on the previous evening west of Eastern.
// See sports-viewer-meta/docs/LINEAGES.md §6.
const feed = ({ timeValid, date }) => ({
  events: [
    {
      id: '401900001',
      date,
      status: { type: { state: 'pre', description: 'Scheduled' }, period: 0 },
      competitions: [
        {
          ...(timeValid === undefined ? {} : { timeValid }),
          competitors: [
            { homeAway: 'home', team: { displayName: 'Serbia' }, score: '0' },
            { homeAway: 'away', team: { displayName: 'Germany' }, score: '0' },
          ],
        },
      ],
    },
  ],
})

const mock = (payload) => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => payload }))
}

// A committed final-phase slot: teams known, tip not announced.
const tbdGame = { num: 87, t1: 'Germany', t2: 'Serbia', espnId: '401900001', ko: null, tbdTip: true }

describe('a tip-off ESPN has not announced', () => {
  it('keeps no instant for a placeholder, so it cannot resolve a to-be-confirmed tip', async () => {
    mock(feed({ timeValid: false, date: '2023-09-08T04:00Z' }))
    const map = await fetchLive(undefined, ['20230908'])
    expect([...map.values()][0].instant).toBeNull()
    const [out] = applyLive([tbdGame], map)
    expect(out.tbdTip).toBe(true)
    expect(out.ko ?? null).toBeNull()
  })

  it('still adopts a real published tip — the feature this must not break', async () => {
    mock(feed({ timeValid: true, date: '2023-09-08T18:30Z' }))
    const map = await fetchLive(undefined, ['20230908'])
    const [out] = applyLive([tbdGame], map)
    expect(out.tbdTip).toBe(false)
    expect(out.ko).toBe('2023-09-08T18:30:00.000Z')
  })

  it('treats a feed that omits the flag as a real time, as it always did', async () => {
    mock(feed({ timeValid: undefined, date: '2023-09-08T18:30Z' }))
    const map = await fetchLive(undefined, ['20230908'])
    const [out] = applyLive([tbdGame], map)
    expect(out.tbdTip).toBe(false)
    expect(out.ko).toBe('2023-09-08T18:30:00.000Z')
  })
})
