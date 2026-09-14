// What the services picker says when games have NO published platform.
//
// The 2027 tournament has no US rights deal yet, so every committed game ships
// with an empty `tv`: `coverageSummary().unknown` is the whole board. The picker
// must count those apart and promise to show them anyway, rather than telling a
// viewer who ticks Cable "you can watch 0 of 92" as if the other 92 were out of
// reach. When the rights deal lands and `tv` fills, the "known" side takes over.

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GAMES } from './fixtures/pretournament-games.js'
import ServicesModal from '../src/components/ServicesModal.jsx'
import { ServicesProvider } from '../src/context/services.jsx'
import { coverageSummary } from '../src/utils/watch.js'

beforeEach(() => localStorage.clear())

describe('a board with no announced platforms', () => {
  it('counts every game as still-to-be-announced and shown anyway', () => {
    render(
      <ServicesProvider>
        <ServicesModal onClose={() => {}} />
      </ServicesProvider>,
    )
    // Nothing selected: every game shown.
    expect(screen.getByText(/every game is shown/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Cable \/ Satellite/ }))
    expect(screen.getByText(/still to be announced, and are always shown/)).toBeInTheDocument()
    expect(coverageSummary(GAMES, ['cable'])).toEqual({
      total: 92,
      known: 0,
      unknown: 92,
      watchable: 0,
    })
  })
})
