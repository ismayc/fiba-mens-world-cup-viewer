// Generate the static, subscribable calendar feed: public/calendar.ics.
//
// The 2023 tournament is complete and frozen, so the feed is a fixed file, not a
// live endpoint. The sibling live viewers back /calendar.ics with a Netlify function
// that fetches ESPN on each request; that cannot work here, because ESPN's fiba slug
// is time-multiplexed and serves NO 2023 event (a single-date query returns 200 with
// an empty `events` list, and the date-RANGE form now 400s family-wide). So the old
// function returned a hard 502 in production. A static file built from the committed
// schedule replaces it, and it works on BOTH GitHub Pages and Netlify, where the
// function only ever ran on Netlify.
//
// The events are produced by the app's OWN builder (utils/ics.js buildICSCollection,
// the exact code behind the "Download all games" button), so a subscribed calendar
// and a downloaded file are byte-for-byte identical apart from DTSTAMP. `matches` is
// resolveBracket(GAMES), the same array the app feeds the calendar (live/history
// overlays are empty for a finished edition, so it reduces to the committed games).
//
// DTSTAMP ("when this iCal object was authored") is frozen to a constant. The app's
// live download stamps it with the current time, which is correct for a fresh
// download but would make this committed file churn on every regenerate. A finished
// tournament's feed is authored once; the constant below is the day after the Final.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { GAMES } from '../src/data/games.js'
import { resolveBracket } from '../src/utils/bracketResolve.js'
import { buildICSCollection } from '../src/utils/ics.js'

// The day after the 2023 Final (played 2023-09-10). A static feed is authored once.
const FROZEN_DTSTAMP = '20230911T000000Z'

export function buildCalendar() {
  const matches = resolveBracket(GAMES)
  const raw = buildICSCollection(matches)
  // Freeze the only non-deterministic field so the committed file is stable.
  return raw.replace(/DTSTAMP:\d{8}T\d{6}Z/g, `DTSTAMP:${FROZEN_DTSTAMP}`)
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'calendar.ics')

// Written whenever this module is the entry point (build:calendar and the prebuild
// hook); importing it from a test only pulls in buildCalendar().
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUT, buildCalendar())
  console.log(`Wrote ${OUT} (${GAMES.length} games)`)
}
