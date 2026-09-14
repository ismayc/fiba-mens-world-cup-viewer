// The FIBA Men's Basketball World Cup 2027 skeleton: format, venues, and a
// PROVISIONAL placeholder draw. This module is the AUTHORITY for structure; when
// FIBA holds the real draw (spring 2027) and publishes the game schedule, the
// team lists, venue assignments and tip-off times here are replaced with the real
// ones, and ESPN then supplies event ids, live clocks and scores on top.
//
// ── EVERYTHING TEAM-SPECIFIC HERE IS A PLACEHOLDER ──
// As of September 2026 only two of the 32 teams are decided: Qatar (host) and
// Türkiye (first through the European qualifiers). Qualification runs to March
// 2027 and the final draw follows it, so no groups, no fixtures and no venue
// assignments exist yet. The 32 nations below are an ILLUSTRATIVE field drawn into
// eight groups so the whole app renders end-to-end; they are not the real
// entrants and the draw has not happened. The UI labels this state explicitly.
// The FORMAT, host, host cities and window ARE verified (Wikipedia / FIBA), and
// so is the knockout crossover wiring (used by FIBA in 2023; see src/utils/bracket.js).
//
// All times are Doha wall clock. All four 2027 arenas are in the Doha metropolitan
// area and Qatar observes AST (UTC+03:00) year-round with no DST, so the whole
// tournament has exactly ONE offset, as the women's Berlin edition did.

export const TZ = 'Asia/Qatar'
export const OFFSET = '+03:00'

export const EDITION = {
  year: 2027,
  host: 'Qatar',
  hostFlag: '🇶🇦',
  city: 'Doha',
  window: '20270827-20270912',
  games: 92,
  teams: 32,
  groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  secondRoundGroups: ['I', 'J', 'K', 'L'],
  venues: 4,
  advancePerGroup: 2, // top two of each group advance, in both group stages
  provisional: true, // the draw has not been held; teams/fixtures are placeholders
}

// The four host arenas, one per host city (all verified as 2027 host cities). The
// specific arena names and per-game assignments are PROVISIONAL pending FIBA's
// venue announcement. `sponsorName` mirrors the women's edition's ESPN-alias slot
// and is left equal to `name` until ESPN files these venues.
export const VENUE_META = {
  lusail: {
    key: 'lusail',
    name: 'Lusail Sports Arena',
    sponsorName: 'Lusail Sports Arena',
    city: 'Lusail',
    country: 'Qatar',
    countryFlag: '🇶🇦',
    tz: TZ,
    capacity: 15300,
    provisional: false, // Lusail Sports Arena is an existing venue; assignment TBD
  },
  attiyah: {
    key: 'attiyah',
    name: 'Ali Bin Hamad Al Attiyah Arena',
    sponsorName: 'Ali Bin Hamad Al Attiyah Arena',
    city: 'Doha',
    country: 'Qatar',
    countryFlag: '🇶🇦',
    tz: TZ,
    capacity: 7700,
    provisional: false,
  },
  rayyan: {
    key: 'rayyan',
    name: 'Al Rayyan Indoor Hall',
    sponsorName: 'Al Rayyan Indoor Hall',
    city: 'Al Rayyan',
    country: 'Qatar',
    countryFlag: '🇶🇦',
    tz: TZ,
    capacity: 5000,
    provisional: true, // arena name provisional pending FIBA announcement
  },
  wakrah: {
    key: 'wakrah',
    name: 'Al Wakrah Sports Hall',
    sponsorName: 'Al Wakrah Sports Hall',
    city: 'Al Wakrah',
    country: 'Qatar',
    countryFlag: '🇶🇦',
    tz: TZ,
    capacity: 5000,
    provisional: true,
  },
}

const VENUE_ORDER = ['lusail', 'attiyah', 'rayyan', 'wakrah']

// Flag emoji per nation in the placeholder field, keyed by canonical (ESPN)
// display name.
export const FLAGS = {
  'United States': '🇺🇸',
  Serbia: '🇷🇸',
  Germany: '🇩🇪',
  Canada: '🇨🇦',
  France: '🇫🇷',
  Australia: '🇦🇺',
  Slovenia: '🇸🇮',
  Spain: '🇪🇸',
  Greece: '🇬🇷',
  Lithuania: '🇱🇹',
  Latvia: '🇱🇻',
  Brazil: '🇧🇷',
  Italy: '🇮🇹',
  Argentina: '🇦🇷',
  Japan: '🇯🇵',
  Türkiye: '🇹🇷',
  'Dominican Republic': '🇩🇴',
  'New Zealand': '🇳🇿',
  'Puerto Rico': '🇵🇷',
  Georgia: '🇬🇪',
  Finland: '🇫🇮',
  'South Sudan': '🇸🇸',
  Lebanon: '🇱🇧',
  Venezuela: '🇻🇪',
  Nigeria: '🇳🇬',
  Egypt: '🇪🇬',
  Angola: '🇦🇴',
  "Côte d'Ivoire": '🇨🇮',
  Philippines: '🇵🇭',
  Jordan: '🇯🇴',
  China: '🇨🇳',
  Qatar: '🇶🇦',
}

// FIBA World Ranking stand-in, strongest first, used to order still-tied teams and
// the pre-tournament tables (see utils/qualification.js byLots). PROVISIONAL: rough
// strength order over the placeholder field, not an official ranking.
export const RANK_ORDER = [
  'United States', 'Serbia', 'Germany', 'Canada', 'France', 'Australia', 'Slovenia',
  'Spain', 'Greece', 'Lithuania', 'Latvia', 'Brazil', 'Italy', 'Argentina', 'Japan',
  'Türkiye', 'Dominican Republic', 'New Zealand', 'Puerto Rico', 'Georgia', 'Finland',
  'South Sudan', 'Lebanon', 'Venezuela', 'Nigeria', 'Egypt', 'Angola', "Côte d'Ivoire",
  'Philippines', 'Jordan', 'China', 'Qatar',
]

// The eight first-round groups (placeholder draw, one nation per notional pot).
export const GROUPS = {
  A: ['United States', 'Greece', 'Dominican Republic', 'Nigeria'],
  B: ['Serbia', 'Lithuania', 'New Zealand', 'Egypt'],
  C: ['Germany', 'Latvia', 'Puerto Rico', 'Angola'],
  D: ['Canada', 'Brazil', 'Georgia', "Côte d'Ivoire"],
  E: ['France', 'Italy', 'Finland', 'Philippines'],
  F: ['Australia', 'Argentina', 'South Sudan', 'Jordan'],
  G: ['Slovenia', 'Japan', 'Lebanon', 'China'],
  H: ['Spain', 'Türkiye', 'Venezuela', 'Qatar'],
}

// Which first-round groups feed each second-round group, and which second-round
// placings feed each quarter-final. See src/utils/qualification.js (R2_MEMBERSHIP)
// and src/utils/bracket.js (the crossover) for the authoritative copies; repeated
// here because scripts cannot import from src/.
const R2_FEED = { I: ['A', 'B'], J: ['C', 'D'], K: ['E', 'F'], L: ['G', 'H'] }

export const ALIASES = {
  USA: 'United States',
  'United States of America': 'United States',
  Turkey: 'Türkiye',
  'Ivory Coast': "Côte d'Ivoire",
}
export const canon = (name) => ALIASES[name] || name

const iso = (date, tip) => (tip ? `${date}T${tip}:00${OFFSET}` : null)
const win = (g) => `Winner Group ${g}`
const second = (g) => `2nd Group ${g}`

// A four-team single round-robin, as three matchdays of two games. Indices into a
// group's team list. Standard circle method.
const RR_ROUNDS = [
  [[0, 3], [1, 2]], // matchday 1
  [[0, 2], [3, 1]], // matchday 2
  [[0, 1], [2, 3]], // matchday 3
]

// Evening Doha tip slots. Every slot is well after local midnight, so each game's
// UTC calendar day equals its Doha day (guards.test.js relies on this).
const TIPS = ['14:00', '16:30', '19:00', '21:30']

// --------------------------------------------------------------------------
// First round: 8 groups x 6 games = 48. Numbered 1-48 in chronological order.
// --------------------------------------------------------------------------
//
// Matchday m is played on two days: groups A-D first, then E-H the next day, so no
// group's decisive games clash with another's on the same slate. Placeholder
// dates within the verified 27 Aug - 12 Sep window.
const R1_DAYS = {
  1: { ABCD: '2027-08-27', EFGH: '2027-08-28' },
  2: { ABCD: '2027-08-29', EFGH: '2027-08-30' },
  3: { ABCD: '2027-08-31', EFGH: '2027-09-01' },
}

function firstRoundGames() {
  const raw = []
  const groups = Object.keys(GROUPS)
  for (const grp of groups) {
    const teams = GROUPS[grp]
    const early = 'ABCD'.includes(grp) ? 'ABCD' : 'EFGH'
    teams.forEach(() => {})
    RR_ROUNDS.forEach((round, mdIdx) => {
      const date = R1_DAYS[mdIdx + 1][early]
      round.forEach(([i, j], gameIdx) => {
        // Spread the two games of a group across tip slots, and stagger groups so
        // the four same-day groups do not all tip together.
        const slot = (groups.indexOf(grp) % 4) + gameIdx
        raw.push({
          group: grp,
          t1: teams[i],
          t2: teams[j],
          date,
          tip: TIPS[slot % TIPS.length],
          venue: VENUE_ORDER[(groups.indexOf(grp) + gameIdx) % VENUE_ORDER.length],
        })
      })
    })
  }
  // Chronological, then group, then first team: a stable total order for numbering.
  raw.sort(
    (a, b) =>
      `${a.date}T${a.tip}`.localeCompare(`${b.date}T${b.tip}`) ||
      a.group.localeCompare(b.group) ||
      a.t1.localeCompare(b.t1),
  )
  return raw.map((g, i) => ({
    num: i + 1,
    stage: 'R1',
    group: g.group,
    t1: g.t1,
    t2: g.t2,
    ko: iso(g.date, g.tip),
    date: g.date,
    venue: g.venue,
  }))
}

// --------------------------------------------------------------------------
// Second round: 4 groups x 4 new games = 16. Numbered 49-64.
// --------------------------------------------------------------------------
//
// A second-round group merges two first-round groups; its four NEW games are the
// cross pairings between the two groups' qualifiers. The two intra-pair games
// carry over from the first round and are not replayed. Teams are unknown until
// the first round finishes, so these carry placing labels.
const R2_DAYS = { 1: '2027-09-03', 2: '2027-09-05' }

function secondRoundGames(startNum) {
  const out = []
  let n = startNum
  const keys = Object.keys(R2_FEED)
  keys.forEach((key, ki) => {
    const [g1, g2] = R2_FEED[key]
    // matchday 1: winners meet, runners-up meet; matchday 2: the cross pairings.
    const rounds = [
      [[win(g1), win(g2)], [second(g1), second(g2)]],
      [[win(g1), second(g2)], [second(g1), win(g2)]],
    ]
    rounds.forEach((pairs, mdIdx) => {
      pairs.forEach(([l1, l2], gi) => {
        out.push({
          num: n++,
          stage: 'R2',
          group: key,
          t1: null,
          t2: null,
          label1: l1,
          label2: l2,
          ko: iso(R2_DAYS[mdIdx + 1], TIPS[(ki + gi) % TIPS.length]),
          date: R2_DAYS[mdIdx + 1],
          venue: VENUE_ORDER[(ki + gi) % VENUE_ORDER.length],
        })
      })
    })
  })
  return out
}

// --------------------------------------------------------------------------
// Classification 17th-32nd: bottom two of each group into groups M-P, 4 new games
// each = 16. Numbered 65-80. NOT bracketed by this viewer (the format engine ranks
// 1-16 only), so these carry honest feeder labels and are never resolved to teams.
// --------------------------------------------------------------------------
const CLASS_FEED = { M: ['A', 'B'], N: ['C', 'D'], O: ['E', 'F'], P: ['G', 'H'] }
const third = (g) => `3rd Group ${g}`
const fourth = (g) => `4th Group ${g}`

function classification1732(startNum) {
  const out = []
  let n = startNum
  Object.keys(CLASS_FEED).forEach((key, ki) => {
    const [g1, g2] = CLASS_FEED[key]
    const rounds = [
      [[third(g1), third(g2)], [fourth(g1), fourth(g2)]],
      [[third(g1), fourth(g2)], [fourth(g1), third(g2)]],
    ]
    rounds.forEach((pairs, mdIdx) => {
      pairs.forEach(([l1, l2], gi) => {
        out.push({
          num: n++,
          stage: 'Class',
          classGroup: key,
          classLabel: '17th–32nd classification',
          t1: null,
          t2: null,
          label1: l1,
          label2: l2,
          ko: iso(mdIdx === 0 ? '2027-09-04' : '2027-09-06', TIPS[(ki + gi) % TIPS.length]),
          date: mdIdx === 0 ? '2027-09-04' : '2027-09-06',
          venue: VENUE_ORDER[(ki + gi) % VENUE_ORDER.length],
        })
      })
    })
  })
  return out
}

// --------------------------------------------------------------------------
// Classification 5th-8th: the four quarter-final losers. 4 games, numbered 81-84.
// Display-only feeder labels (Loser Game N); not resolved.
// --------------------------------------------------------------------------
function classification58(startNum) {
  return [
    { num: startNum, stage: 'Class', classLabel: '5th–8th classification', label1: 'Loser Game 85', label2: 'Loser Game 88', date: '2027-09-11', tip: '16:00', venue: 'rayyan' },
    { num: startNum + 1, stage: 'Class', classLabel: '5th–8th classification', label1: 'Loser Game 86', label2: 'Loser Game 87', date: '2027-09-11', tip: '18:30', venue: 'wakrah' },
    { num: startNum + 2, stage: 'Class', classLabel: '7th place', label1: 'Loser Game 81', label2: 'Loser Game 82', date: '2027-09-12', tip: '13:00', venue: 'rayyan' },
    { num: startNum + 3, stage: 'Class', classLabel: '5th place', label1: 'Winner Game 81', label2: 'Winner Game 82', date: '2027-09-12', tip: '15:30', venue: 'wakrah' },
  ].map((g) => ({ ...g, t1: null, t2: null, ko: iso(g.date, g.tip) }))
}

// --------------------------------------------------------------------------
// Knockout: QF 85-88, SF 89-90, third place 91, Final 92. THE WIRING mirrors
// src/utils/bracket.js (I<->L and J<->K cross; the balanced 4-4 bracket). Verified
// against the 2023 tournament; working default until FIBA publishes the 2027 sheet.
// --------------------------------------------------------------------------
const KNOCKOUT = [
  { num: 85, stage: 'QF', date: '2027-09-08', tip: '17:00', label1: win('I'), label2: second('L'), venue: 'lusail' },
  { num: 86, stage: 'QF', date: '2027-09-08', tip: '20:00', label1: win('L'), label2: second('I'), venue: 'attiyah' },
  { num: 87, stage: 'QF', date: '2027-09-09', tip: '17:00', label1: win('J'), label2: second('K'), venue: 'lusail' },
  { num: 88, stage: 'QF', date: '2027-09-09', tip: '20:00', label1: win('K'), label2: second('J'), venue: 'attiyah' },
  { num: 89, stage: 'SF', date: '2027-09-10', tip: '17:00', label1: 'Winner Game 85', label2: 'Winner Game 87', venue: 'lusail' },
  { num: 90, stage: 'SF', date: '2027-09-10', tip: '20:30', label1: 'Winner Game 86', label2: 'Winner Game 88', venue: 'lusail' },
  { num: 91, stage: '3rd', date: '2027-09-12', tip: '17:00', label1: 'Loser Game 89', label2: 'Loser Game 90', venue: 'lusail' },
  { num: 92, stage: 'Final', date: '2027-09-12', tip: '20:30', label1: 'Winner Game 89', label2: 'Winner Game 90', venue: 'lusail' },
].map((g) => ({ ...g, t1: null, t2: null, ko: iso(g.date, g.tip) }))

// --------------------------------------------------------------------------
// Assembly
// --------------------------------------------------------------------------
export function officialGames() {
  const r1 = firstRoundGames()
  const r2 = secondRoundGames(r1.length + 1) // 49-64
  const c1732 = classification1732(r1.length + r2.length + 1) // 65-80
  const c58 = classification58(r1.length + r2.length + c1732.length + 1) // 81-84
  const all = [...r1, ...r2, ...c1732, ...c58, ...KNOCKOUT]
  return all.map((g) => ({ ...g, tbdTip: g.ko === null }))
}

export const OFFICIAL = officialGames()
