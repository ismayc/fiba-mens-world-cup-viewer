// The single source of this edition's identity, vocabulary, and display rules.
//
// Everything a component or util would otherwise hardcode inline lives here: the ESPN
// path, the storage prefix, the period vocabulary, the game-length window, the host
// city, the .ics identity, the deploy host. The pattern comes from the-nfl-schedule;
// this is the tenth repo in the family to get it.
//
// Two rules this file is written to:
//
//   1. Every field below has a real consumer in src/. A field only a config reader
//      touches is a shallow module pretending to be a seam, and the NFL original grew
//      seven of them. The exceptions are marked: `title` and `themeColor` are consumed
//      by test/chrome-identity.test.js, because index.html and the manifest are static
//      files no module can import.
//
//   2. Structure stays out. FIRST_ROUND_GROUPS, R2_MEMBERSHIP, ADVANCING_PER_GROUP,
//      GROUP_GAME_COUNT, the 2/1 points model and the restart-the-procedure tie-break
//      all stay in utils/qualification.js, utils/secondRound.js and utils/slots.js.
//      The men's group phase feeds a SECOND group stage (top two of each first-round
//      group carry their head-to-head into a four-team second-round group), which are
//      rules rather than facts.
//
// This is basketball on a chassis built for football, so it takes vocabulary from the
// basketball siblings (periodShort, regulationPeriods, overtimeLabel) and everything
// else from the tournament ones. Grown from fiba-womens-world-cup-viewer, whose single
// group stage and group-winner bye it replaces with the men's two-stage carryover.

export const LEAGUE = {
  id: 'fmwc',
  // The competition, without the year. The .ics summary abbreviates it further.
  name: "FIBA Men's World Cup",
  icsSummaryPrefix: 'FIBA MWC',
  // The full product title: index.html's <title> and the manifest's name.
  title: "FIBA Men's World Cup 2023 — Schedule Viewer",
  // The edition, used as a calendar name.
  edition: "FIBA Men's World Cup 2023",
  season: 2023,
  espnPath: 'basketball/fiba',
  storageKey: 'fmwc', // 'fmwc:theme', 'fmwc:followed', 'fmwc:asItStands', …
  // UI chrome only. Matches --bg in index.css, <meta name="theme-color">, and the
  // manifest's theme_color and background_color.
  themeColor: '#15171b',

  // ── Vocabulary ──────────────────────────────────────────────────────────────
  periodNoun: 'quarter',
  periodShort: 'Q', // Q1…Q4
  regulationPeriods: 4,
  overtimeLabel: 'OT',
  // Basketball says "vs", not football's "v".
  homeAwaySep: 'vs',

  // ── The host ────────────────────────────────────────────────────────────────
  // 2023 was co-hosted across three countries and five arenas on THREE timezones
  // (the Philippines +08:00, Okinawa/Japan +09:00, Jakarta/Indonesia +07:00), so a
  // game's clock comes from its own venue (utils/venue.js reads VENUES[game.venue].tz),
  // not from a single tournament zone. This `host` is the final-phase host: the
  // quarter-finals onward were played at the Mall of Asia Arena in Metro Manila.
  // It seeds the timezone picker and backs the venue fallback for a rare venue-less
  // game; every arena's own timezone is added to the picker in utils/time.js.
  host: {
    city: 'Manila',
    country: 'Philippines',
    countryFlag: '🇵🇭',
    tz: 'Asia/Manila',
  },

  // ── Time ────────────────────────────────────────────────────────────────────
  locale: 'en-US',
  // The block a calendar should reserve and the window in which a tipped game with no
  // feed still reads as live.
  gameLengthMinutes: 135,

  // ── Calendar export ─────────────────────────────────────────────────────────
  // "game", not "match": this competition plays games, and the UID has said so from
  // the start. The year is deliberate, so a future edition's feed cannot overwrite this
  // one in a subscriber's calendar.
  ics: {
    prodId: "-//FIBA Men's World Cup 2023 Viewer//EN",
    domain: 'fibamensworldcupviewer',
    uidPrefix: 'fibamwc2023-game-',
    filenameBase: 'fiba-mens-world-cup-2023',
  },

  // Netlify serves /calendar.ics; GitHub Pages cannot run the function. Both hosts are
  // live once the Netlify site is created and linked for this repo.
  feedHost: 'https://fiba-mens-world-cup-viewer.netlify.app',
}
