// The REAL 2023 FIBA Men's Basketball World Cup: the frozen, verified authority
// for this viewer. Germany won it, beating Serbia in the final; Canada took bronze
// past the United States. The tournament was co-hosted by the Philippines, Japan
// and Indonesia across five arenas in five cities, and ran 25 August - 10 September
// 2023.
//
// ── SOURCE AND VERIFICATION ──
// Every team, group, score, date and venue below was parsed from Wikipedia's
// per-group match tables and cross-checked: the standings this data produces match
// Wikipedia's own group tables exactly (all eight first-round groups and all four
// second-round groups), and the resolved bracket matches the real quarter-finals,
// semi-finals, third-place game and final. See docs/findings for the two engine
// bugs this real data uncovered (the second-round carryover model and the knockout
// crossover), both fixed before this data was frozen.
//
// ── FORMAT ──
// Eight first-round groups A-H of four. The top two of each advance to four
// second-round groups I-L (A&B -> I, C&D -> J, E&F -> K, G&H -> L), carrying their
// FULL first-round record forward (all five group-stage games count). The top two
// of each second-round group reach an eight-team knockout; the crossover is I<->J
// and K<->L (verified: Italy [1st I] met USA [2nd J], Germany [1st K] met Latvia
// [2nd L]). The bottom two of each first-round group play classification for
// 17th-32nd (groups M-P); the four quarter-final losers play for 5th-8th. This
// viewer ranks 1-16 seriously and shows the classification games without bracketing
// them.
//
// ── TIME ──
// Times are stored at each venue's local wall clock: the Philippines on +08:00,
// Okinawa (Japan) on +09:00, Jakarta (Indonesia) on +07:00, none observing DST. The
// viewer converts every tip-off to the reader's own timezone.

export const EDITION = {
  year: 2023,
  hosts: ['Philippines', 'Japan', 'Indonesia'],
  hostFlags: ['🇵🇭', '🇯🇵', '🇮🇩'],
  cities: ['Manila', 'Okinawa', 'Jakarta'],
  window: '20230825-20230910',
  games: 92,
  teams: 32,
  groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  secondRoundGroups: ['I', 'J', 'K', 'L'],
  venues: 5,
  advancePerGroup: 2, // top two of each group advance, in both group stages
  provisional: false, // the real, completed 2023 tournament
}

// The five host arenas, keyed by short id, each on its own timezone. `sponsorName`
// mirrors the family's ESPN-alias slot and equals `name` here (no ESPN feed backs
// a completed 2023 tournament).
export const VENUE_META = {
  philippinearena: { key: 'philippinearena', name: "Philippine Arena", sponsorName: "Philippine Arena", city: "Bocaue", country: "Philippines", countryFlag: '🇵🇭', tz: 'Asia/Manila', offset: '+08:00', capacity: 55000 },
  moa: { key: 'moa', name: "Mall of Asia Arena", sponsorName: "Mall of Asia Arena", city: "Pasay", country: "Philippines", countryFlag: '🇵🇭', tz: 'Asia/Manila', offset: '+08:00', capacity: 15000 },
  araneta: { key: 'araneta', name: "Araneta Coliseum", sponsorName: "Araneta Coliseum", city: "Quezon City", country: "Philippines", countryFlag: '🇵🇭', tz: 'Asia/Manila', offset: '+08:00', capacity: 15000 },
  okinawa: { key: 'okinawa', name: "Okinawa Arena", sponsorName: "Okinawa Arena", city: "Okinawa", country: "Japan", countryFlag: '🇯🇵', tz: 'Asia/Tokyo', offset: '+09:00', capacity: 10000 },
  jakarta: { key: 'jakarta', name: "Indonesia Arena", sponsorName: "Indonesia Arena", city: "Jakarta", country: "Indonesia", countryFlag: '🇮🇩', tz: 'Asia/Jakarta', offset: '+07:00', capacity: 16500 },
}

// Flag emoji per nation, keyed by canonical (ESPN) display name.
export const FLAGS = {
  "Angola": '🇦🇴',
  "Italy": '🇮🇹',
  "Dominican Republic": '🇩🇴',
  "Philippines": '🇵🇭',
  "South Sudan": '🇸🇸',
  "Puerto Rico": '🇵🇷',
  "Serbia": '🇷🇸',
  "China": '🇨🇳',
  "United States": '🇺🇸',
  "Jordan": '🇯🇴',
  "Greece": '🇬🇷',
  "New Zealand": '🇳🇿',
  "Egypt": '🇪🇬',
  "Mexico": '🇲🇽',
  "Montenegro": '🇲🇪',
  "Lithuania": '🇱🇹',
  "Germany": '🇩🇪',
  "Japan": '🇯🇵',
  "Australia": '🇦🇺',
  "Finland": '🇫🇮',
  "Slovenia": '🇸🇮',
  "Venezuela": '🇻🇪',
  "Georgia": '🇬🇪',
  "Cape Verde": '🇨🇻',
  "Iran": '🇮🇷',
  "Spain": '🇪🇸',
  "Côte d'Ivoire": '🇨🇮',
  "Brazil": '🇧🇷',
  "Canada": '🇨🇦',
  "Latvia": '🇱🇻',
  "Lebanon": '🇱🇧',
  "France": '🇫🇷',
}

// FIBA World Ranking (February 2023, pre-tournament), strongest first. Used to order
// still-level teams and any pre-tournament projected table (see qualification.js
// byLots). This is the real seeding ranking, not a stand-in.
export const RANK_ORDER = [
  "Spain",
  "United States",
  "Australia",
  "France",
  "Serbia",
  "Slovenia",
  "Lithuania",
  "Greece",
  "Italy",
  "Germany",
  "Brazil",
  "Canada",
  "Venezuela",
  "Montenegro",
  "Puerto Rico",
  "Iran",
  "Dominican Republic",
  "Finland",
  "New Zealand",
  "China",
  "Latvia",
  "Mexico",
  "Georgia",
  "Jordan",
  "Japan",
  "Philippines",
  "Angola",
  "Lebanon",
  "Côte d'Ivoire",
  "Egypt",
  "South Sudan",
  "Cape Verde",
]

// The eight first-round groups (the real 2023 draw), strongest first by ranking.
export const GROUPS = {
  A: ["Italy", "Dominican Republic", "Philippines", "Angola"],
  B: ["Serbia", "Puerto Rico", "China", "South Sudan"],
  C: ["United States", "Greece", "New Zealand", "Jordan"],
  D: ["Lithuania", "Montenegro", "Mexico", "Egypt"],
  E: ["Australia", "Germany", "Finland", "Japan"],
  F: ["Slovenia", "Venezuela", "Georgia", "Cape Verde"],
  G: ["Spain", "Brazil", "Iran", "Côte d'Ivoire"],
  H: ["France", "Canada", "Latvia", "Lebanon"],
}

export const ALIASES = {
  USA: 'United States',
  'United States of America': 'United States',
  Turkey: 'Türkiye',
  'Ivory Coast': "Côte d'Ivoire",
}
export const canon = (name) => ALIASES[name] || name

// The 92 games of the real 2023 tournament, numbered 1-48 (first round), 49-64
// (second round), 65-80 (17th-32nd classification), 81-84 (5th-8th classification),
// 85-88 (quarter-finals), 89-90 (semi-finals), 91 (third place), 92 (final). Every
// game carries its resolved teams AND the seeding label it was drawn with, so the
// bracket resolver reproduces the tournament from the labels alone.
const RAW_GAMES = [
  { num: 1, stage: "R1", group: "A", t1: "Angola", t2: "Italy", score: [67, 81], venue: "philippinearena", ko: "2023-08-25T16:00:00+08:00", date: "2023-08-25" },
  { num: 2, stage: "R1", group: "H", t1: "Latvia", t2: "Lebanon", score: [109, 70], venue: "jakarta", ko: "2023-08-25T16:15:00+07:00", date: "2023-08-25" },
  { num: 3, stage: "R1", group: "D", t1: "Mexico", t2: "Montenegro", score: [71, 91], venue: "moa", ko: "2023-08-25T16:45:00+08:00", date: "2023-08-25" },
  { num: 4, stage: "R1", group: "E", t1: "Finland", t2: "Australia", score: [72, 98], venue: "okinawa", ko: "2023-08-25T17:00:00+09:00", date: "2023-08-25" },
  { num: 5, stage: "R1", group: "A", t1: "Dominican Republic", t2: "Philippines", score: [87, 81], venue: "philippinearena", ko: "2023-08-25T20:00:00+08:00", date: "2023-08-25" },
  { num: 6, stage: "R1", group: "H", t1: "Canada", t2: "France", score: [95, 65], venue: "jakarta", ko: "2023-08-25T20:30:00+07:00", date: "2023-08-25" },
  { num: 7, stage: "R1", group: "D", t1: "Egypt", t2: "Lithuania", score: [67, 93], venue: "moa", ko: "2023-08-25T20:30:00+08:00", date: "2023-08-25" },
  { num: 8, stage: "R1", group: "E", t1: "Germany", t2: "Japan", score: [81, 63], venue: "okinawa", ko: "2023-08-25T21:10:00+09:00", date: "2023-08-25" },
  { num: 9, stage: "R1", group: "B", t1: "South Sudan", t2: "Puerto Rico", score: [96, 101], venue: "araneta", ko: "2023-08-26T16:00:00+08:00", date: "2023-08-26" },
  { num: 10, stage: "R1", group: "G", t1: "Iran", t2: "Brazil", score: [59, 100], venue: "jakarta", ko: "2023-08-26T16:45:00+07:00", date: "2023-08-26" },
  { num: 11, stage: "R1", group: "C", t1: "Jordan", t2: "Greece", score: [71, 92], venue: "moa", ko: "2023-08-26T16:45:00+08:00", date: "2023-08-26" },
  { num: 12, stage: "R1", group: "F", t1: "Cape Verde", t2: "Georgia", score: [60, 85], venue: "okinawa", ko: "2023-08-26T17:00:00+09:00", date: "2023-08-26" },
  { num: 13, stage: "R1", group: "B", t1: "Serbia", t2: "China", score: [105, 63], venue: "araneta", ko: "2023-08-26T20:00:00+08:00", date: "2023-08-26" },
  { num: 14, stage: "R1", group: "G", t1: "Spain", t2: "Côte d'Ivoire", score: [94, 64], venue: "jakarta", ko: "2023-08-26T20:30:00+07:00", date: "2023-08-26" },
  { num: 15, stage: "R1", group: "F", t1: "Slovenia", t2: "Venezuela", score: [100, 85], venue: "okinawa", ko: "2023-08-26T20:30:00+09:00", date: "2023-08-26" },
  { num: 16, stage: "R1", group: "C", t1: "United States", t2: "New Zealand", score: [99, 72], venue: "moa", ko: "2023-08-26T20:40:00+08:00", date: "2023-08-26" },
  { num: 17, stage: "R1", group: "A", t1: "Italy", t2: "Dominican Republic", score: [82, 87], venue: "araneta", ko: "2023-08-27T16:00:00+08:00", date: "2023-08-27" },
  { num: 18, stage: "R1", group: "H", t1: "Lebanon", t2: "Canada", score: [73, 128], venue: "jakarta", ko: "2023-08-27T16:45:00+07:00", date: "2023-08-27" },
  { num: 19, stage: "R1", group: "D", t1: "Montenegro", t2: "Egypt", score: [89, 74], venue: "moa", ko: "2023-08-27T16:45:00+08:00", date: "2023-08-27" },
  { num: 20, stage: "R1", group: "E", t1: "Australia", t2: "Germany", score: [82, 85], venue: "okinawa", ko: "2023-08-27T17:30:00+09:00", date: "2023-08-27" },
  { num: 21, stage: "R1", group: "A", t1: "Philippines", t2: "Angola", score: [70, 80], venue: "araneta", ko: "2023-08-27T20:00:00+08:00", date: "2023-08-27" },
  { num: 22, stage: "R1", group: "H", t1: "France", t2: "Latvia", score: [86, 88], venue: "jakarta", ko: "2023-08-27T20:30:00+07:00", date: "2023-08-27" },
  { num: 23, stage: "R1", group: "D", t1: "Lithuania", t2: "Mexico", score: [96, 66], venue: "moa", ko: "2023-08-27T20:30:00+08:00", date: "2023-08-27" },
  { num: 24, stage: "R1", group: "E", t1: "Japan", t2: "Finland", score: [98, 88], venue: "okinawa", ko: "2023-08-27T21:10:00+09:00", date: "2023-08-27" },
  { num: 25, stage: "R1", group: "B", t1: "China", t2: "South Sudan", score: [69, 89], venue: "araneta", ko: "2023-08-28T16:00:00+08:00", date: "2023-08-28" },
  { num: 26, stage: "R1", group: "G", t1: "Côte d'Ivoire", t2: "Iran", score: [71, 69], venue: "jakarta", ko: "2023-08-28T16:45:00+07:00", date: "2023-08-28" },
  { num: 27, stage: "R1", group: "C", t1: "New Zealand", t2: "Jordan", score: [95, 87], venue: "moa", ko: "2023-08-28T16:45:00+08:00", date: "2023-08-28" },
  { num: 28, stage: "R1", group: "F", t1: "Venezuela", t2: "Cape Verde", score: [75, 81], venue: "okinawa", ko: "2023-08-28T17:00:00+09:00", date: "2023-08-28" },
  { num: 29, stage: "R1", group: "B", t1: "Puerto Rico", t2: "Serbia", score: [77, 94], venue: "araneta", ko: "2023-08-28T20:00:00+08:00", date: "2023-08-28" },
  { num: 30, stage: "R1", group: "G", t1: "Brazil", t2: "Spain", score: [78, 96], venue: "jakarta", ko: "2023-08-28T20:30:00+07:00", date: "2023-08-28" },
  { num: 31, stage: "R1", group: "F", t1: "Georgia", t2: "Slovenia", score: [67, 88], venue: "okinawa", ko: "2023-08-28T20:30:00+09:00", date: "2023-08-28" },
  { num: 32, stage: "R1", group: "C", t1: "Greece", t2: "United States", score: [81, 109], venue: "moa", ko: "2023-08-28T20:40:00+08:00", date: "2023-08-28" },
  { num: 33, stage: "R1", group: "A", t1: "Angola", t2: "Dominican Republic", score: [67, 75], venue: "araneta", ko: "2023-08-29T16:00:00+08:00", date: "2023-08-29" },
  { num: 34, stage: "R1", group: "E", t1: "Germany", t2: "Finland", score: [101, 75], venue: "okinawa", ko: "2023-08-29T16:30:00+09:00", date: "2023-08-29" },
  { num: 35, stage: "R1", group: "H", t1: "Lebanon", t2: "France", score: [79, 85], venue: "jakarta", ko: "2023-08-29T16:45:00+07:00", date: "2023-08-29" },
  { num: 36, stage: "R1", group: "D", t1: "Egypt", t2: "Mexico", score: [100, 72], venue: "moa", ko: "2023-08-29T16:45:00+08:00", date: "2023-08-29" },
  { num: 37, stage: "R1", group: "A", t1: "Philippines", t2: "Italy", score: [83, 90], venue: "araneta", ko: "2023-08-29T20:00:00+08:00", date: "2023-08-29" },
  { num: 38, stage: "R1", group: "E", t1: "Australia", t2: "Japan", score: [109, 89], venue: "okinawa", ko: "2023-08-29T20:10:00+09:00", date: "2023-08-29" },
  { num: 39, stage: "R1", group: "H", t1: "Canada", t2: "Latvia", score: [101, 75], venue: "jakarta", ko: "2023-08-29T20:30:00+07:00", date: "2023-08-29" },
  { num: 40, stage: "R1", group: "D", t1: "Montenegro", t2: "Lithuania", score: [71, 91], venue: "moa", ko: "2023-08-29T20:30:00+08:00", date: "2023-08-29" },
  { num: 41, stage: "R1", group: "B", t1: "South Sudan", t2: "Serbia", score: [83, 115], venue: "araneta", ko: "2023-08-30T16:00:00+08:00", date: "2023-08-30" },
  { num: 42, stage: "R1", group: "C", t1: "United States", t2: "Jordan", score: [110, 62], venue: "moa", ko: "2023-08-30T16:40:00+08:00", date: "2023-08-30" },
  { num: 43, stage: "R1", group: "G", t1: "Côte d'Ivoire", t2: "Brazil", score: [77, 89], venue: "jakarta", ko: "2023-08-30T16:45:00+07:00", date: "2023-08-30" },
  { num: 44, stage: "R1", group: "F", t1: "Georgia", t2: "Venezuela", score: [70, 59], venue: "okinawa", ko: "2023-08-30T17:00:00+09:00", date: "2023-08-30" },
  { num: 45, stage: "R1", group: "B", t1: "China", t2: "Puerto Rico", score: [89, 107], venue: "araneta", ko: "2023-08-30T20:00:00+08:00", date: "2023-08-30" },
  { num: 46, stage: "R1", group: "G", t1: "Iran", t2: "Spain", score: [65, 85], venue: "jakarta", ko: "2023-08-30T20:30:00+07:00", date: "2023-08-30" },
  { num: 47, stage: "R1", group: "F", t1: "Slovenia", t2: "Cape Verde", score: [92, 77], venue: "okinawa", ko: "2023-08-30T20:30:00+09:00", date: "2023-08-30" },
  { num: 48, stage: "R1", group: "C", t1: "Greece", t2: "New Zealand", score: [83, 74], venue: "moa", ko: "2023-08-30T20:40:00+08:00", date: "2023-08-30" },
  { num: 49, stage: "R2", group: "I", t1: "Serbia", t2: "Italy", label1: "Winner Group B", label2: "2nd Group A", score: [76, 78], venue: "araneta", ko: "2023-09-01T16:00:00+08:00", date: "2023-09-01" },
  { num: 50, stage: "R2", group: "J", t1: "United States", t2: "Montenegro", label1: "Winner Group C", label2: "2nd Group D", score: [85, 73], venue: "moa", ko: "2023-09-01T16:40:00+08:00", date: "2023-09-01" },
  { num: 51, stage: "R2", group: "L", t1: "Spain", t2: "Latvia", label1: "Winner Group G", label2: "2nd Group H", score: [69, 74], venue: "jakarta", ko: "2023-09-01T16:45:00+07:00", date: "2023-09-01" },
  { num: 52, stage: "R2", group: "K", t1: "Germany", t2: "Georgia", label1: "Winner Group E", label2: "2nd Group F", score: [100, 73], venue: "okinawa", ko: "2023-09-01T17:30:00+09:00", date: "2023-09-01" },
  { num: 53, stage: "R2", group: "I", t1: "Dominican Republic", t2: "Puerto Rico", label1: "Winner Group A", label2: "2nd Group B", score: [97, 102], venue: "araneta", ko: "2023-09-01T20:00:00+08:00", date: "2023-09-01" },
  { num: 54, stage: "R2", group: "L", t1: "Canada", t2: "Brazil", label1: "Winner Group H", label2: "2nd Group G", score: [65, 69], venue: "jakarta", ko: "2023-09-01T20:30:00+07:00", date: "2023-09-01" },
  { num: 55, stage: "R2", group: "J", t1: "Lithuania", t2: "Greece", label1: "Winner Group D", label2: "2nd Group C", score: [92, 67], venue: "moa", ko: "2023-09-01T20:40:00+08:00", date: "2023-09-01" },
  { num: 56, stage: "R2", group: "K", t1: "Slovenia", t2: "Australia", label1: "Winner Group F", label2: "2nd Group E", score: [91, 80], venue: "okinawa", ko: "2023-09-01T21:10:00+09:00", date: "2023-09-01" },
  { num: 57, stage: "R2", group: "I", t1: "Italy", t2: "Puerto Rico", label1: "2nd Group A", label2: "2nd Group B", score: [73, 57], venue: "araneta", ko: "2023-09-03T16:00:00+08:00", date: "2023-09-03" },
  { num: 58, stage: "R2", group: "K", t1: "Australia", t2: "Georgia", label1: "2nd Group E", label2: "2nd Group F", score: [100, 84], venue: "okinawa", ko: "2023-09-03T16:30:00+09:00", date: "2023-09-03" },
  { num: 59, stage: "R2", group: "J", t1: "Greece", t2: "Montenegro", label1: "2nd Group C", label2: "2nd Group D", score: [69, 73], venue: "moa", ko: "2023-09-03T16:40:00+08:00", date: "2023-09-03" },
  { num: 60, stage: "R2", group: "L", t1: "Brazil", t2: "Latvia", label1: "2nd Group G", label2: "2nd Group H", score: [84, 104], venue: "jakarta", ko: "2023-09-03T16:45:00+07:00", date: "2023-09-03" },
  { num: 61, stage: "R2", group: "I", t1: "Dominican Republic", t2: "Serbia", label1: "Winner Group A", label2: "Winner Group B", score: [79, 112], venue: "araneta", ko: "2023-09-03T20:00:00+08:00", date: "2023-09-03" },
  { num: 62, stage: "R2", group: "K", t1: "Germany", t2: "Slovenia", label1: "Winner Group E", label2: "Winner Group F", score: [100, 71], venue: "okinawa", ko: "2023-09-03T20:10:00+09:00", date: "2023-09-03" },
  { num: 63, stage: "R2", group: "L", t1: "Spain", t2: "Canada", label1: "Winner Group G", label2: "Winner Group H", score: [85, 88], venue: "jakarta", ko: "2023-09-03T20:30:00+07:00", date: "2023-09-03" },
  { num: 64, stage: "R2", group: "J", t1: "United States", t2: "Lithuania", label1: "Winner Group C", label2: "Winner Group D", score: [104, 110], venue: "moa", ko: "2023-09-03T20:40:00+08:00", date: "2023-09-03" },
  { num: 65, stage: "Class", classGroup: "M", classLabel: "17th–32nd classification", t1: "Angola", t2: "China", label1: "3rd Group A", label2: "4th Group B", score: [76, 83], venue: "araneta", ko: "2023-08-31T16:00:00+08:00", date: "2023-08-31" },
  { num: 66, stage: "Class", classGroup: "O", classLabel: "17th–32nd classification", t1: "Cape Verde", t2: "Finland", label1: "3rd Group F", label2: "4th Group E", score: [77, 100], venue: "okinawa", ko: "2023-08-31T16:30:00+09:00", date: "2023-08-31" },
  { num: 67, stage: "Class", classGroup: "P", classLabel: "17th–32nd classification", t1: "Côte d'Ivoire", t2: "Lebanon", label1: "3rd Group G", label2: "4th Group H", score: [84, 94], venue: "jakarta", ko: "2023-08-31T16:45:00+07:00", date: "2023-08-31" },
  { num: 68, stage: "Class", classGroup: "N", classLabel: "17th–32nd classification", t1: "New Zealand", t2: "Mexico", label1: "3rd Group C", label2: "4th Group D", score: [100, 108], venue: "moa", ko: "2023-08-31T16:45:00+08:00", date: "2023-08-31" },
  { num: 69, stage: "Class", classGroup: "M", classLabel: "17th–32nd classification", t1: "South Sudan", t2: "Philippines", label1: "3rd Group B", label2: "4th Group A", score: [87, 68], venue: "araneta", ko: "2023-08-31T20:00:00+08:00", date: "2023-08-31" },
  { num: 70, stage: "Class", classGroup: "O", classLabel: "17th–32nd classification", t1: "Japan", t2: "Venezuela", label1: "3rd Group E", label2: "4th Group F", score: [86, 77], venue: "okinawa", ko: "2023-08-31T20:10:00+09:00", date: "2023-08-31" },
  { num: 71, stage: "Class", classGroup: "P", classLabel: "17th–32nd classification", t1: "France", t2: "Iran", label1: "3rd Group H", label2: "4th Group G", score: [82, 55], venue: "jakarta", ko: "2023-08-31T20:30:00+07:00", date: "2023-08-31" },
  { num: 72, stage: "Class", classGroup: "N", classLabel: "17th–32nd classification", t1: "Egypt", t2: "Jordan", label1: "3rd Group D", label2: "4th Group C", score: [85, 69], venue: "moa", ko: "2023-08-31T20:30:00+08:00", date: "2023-08-31" },
  { num: 73, stage: "Class", classGroup: "M", classLabel: "17th–32nd classification", t1: "Angola", t2: "South Sudan", label1: "3rd Group A", label2: "3rd Group B", score: [78, 101], venue: "araneta", ko: "2023-09-02T16:00:00+08:00", date: "2023-09-02" },
  { num: 74, stage: "Class", classGroup: "O", classLabel: "17th–32nd classification", t1: "Finland", t2: "Venezuela", label1: "4th Group E", label2: "4th Group F", score: [90, 75], venue: "okinawa", ko: "2023-09-02T16:30:00+09:00", date: "2023-09-02" },
  { num: 75, stage: "Class", classGroup: "P", classLabel: "17th–32nd classification", t1: "Côte d'Ivoire", t2: "France", label1: "3rd Group G", label2: "3rd Group H", score: [77, 87], venue: "jakarta", ko: "2023-09-02T16:45:00+07:00", date: "2023-09-02" },
  { num: 76, stage: "Class", classGroup: "N", classLabel: "17th–32nd classification", t1: "New Zealand", t2: "Egypt", label1: "3rd Group C", label2: "3rd Group D", score: [88, 86], venue: "moa", ko: "2023-09-02T16:45:00+08:00", date: "2023-09-02" },
  { num: 77, stage: "Class", classGroup: "M", classLabel: "17th–32nd classification", t1: "Philippines", t2: "China", label1: "4th Group A", label2: "4th Group B", score: [96, 75], venue: "araneta", ko: "2023-09-02T20:00:00+08:00", date: "2023-09-02" },
  { num: 78, stage: "Class", classGroup: "O", classLabel: "17th–32nd classification", t1: "Japan", t2: "Cape Verde", label1: "3rd Group E", label2: "3rd Group F", score: [80, 71], venue: "okinawa", ko: "2023-09-02T20:10:00+09:00", date: "2023-09-02" },
  { num: 79, stage: "Class", classGroup: "P", classLabel: "17th–32nd classification", t1: "Iran", t2: "Lebanon", label1: "4th Group G", label2: "4th Group H", score: [73, 81], venue: "jakarta", ko: "2023-09-02T20:30:00+07:00", date: "2023-09-02" },
  { num: 80, stage: "Class", classGroup: "N", classLabel: "17th–32nd classification", t1: "Jordan", t2: "Mexico", label1: "4th Group C", label2: "4th Group D", score: [80, 93], venue: "moa", ko: "2023-09-02T20:30:00+08:00", date: "2023-09-02" },
  { num: 81, stage: "Class", classLabel: "5th–8th classification", t1: "Italy", t2: "Latvia", label1: "Loser Game 85", label2: "Loser Game 87", score: [82, 87], venue: "moa", ko: "2023-09-07T16:45:00+08:00", date: "2023-09-07" },
  { num: 82, stage: "Class", classLabel: "5th–8th classification", t1: "Lithuania", t2: "Slovenia", label1: "Loser Game 86", label2: "Loser Game 88", score: [100, 84], venue: "moa", ko: "2023-09-07T20:30:00+08:00", date: "2023-09-07" },
  { num: 83, stage: "Class", classLabel: "7th place", t1: "Italy", t2: "Slovenia", label1: "Loser Game 81", label2: "Loser Game 82", score: [85, 89], venue: "moa", ko: "2023-09-09T16:45:00+08:00", date: "2023-09-09" },
  { num: 84, stage: "Class", classLabel: "5th place", t1: "Latvia", t2: "Lithuania", label1: "Winner Game 81", label2: "Winner Game 82", score: [98, 63], venue: "moa", ko: "2023-09-09T20:30:00+08:00", date: "2023-09-09" },
  { num: 85, stage: "QF", t1: "Italy", t2: "United States", label1: "Winner Group I", label2: "2nd Group J", score: [63, 100], venue: "moa", ko: "2023-09-05T20:40:00+08:00", date: "2023-09-05" },
  { num: 86, stage: "QF", t1: "Lithuania", t2: "Serbia", label1: "Winner Group J", label2: "2nd Group I", score: [68, 87], venue: "moa", ko: "2023-09-05T16:45:00+08:00", date: "2023-09-05" },
  { num: 87, stage: "QF", t1: "Germany", t2: "Latvia", label1: "Winner Group K", label2: "2nd Group L", score: [81, 79], venue: "moa", ko: "2023-09-06T16:45:00+08:00", date: "2023-09-06" },
  { num: 88, stage: "QF", t1: "Canada", t2: "Slovenia", label1: "Winner Group L", label2: "2nd Group K", score: [100, 89], venue: "moa", ko: "2023-09-06T20:30:00+08:00", date: "2023-09-06" },
  { num: 89, stage: "SF", t1: "United States", t2: "Germany", label1: "Winner Game 85", label2: "Winner Game 87", score: [111, 113], venue: "moa", ko: "2023-09-08T20:40:00+08:00", date: "2023-09-08" },
  { num: 90, stage: "SF", t1: "Serbia", t2: "Canada", label1: "Winner Game 86", label2: "Winner Game 88", score: [95, 86], venue: "moa", ko: "2023-09-08T16:45:00+08:00", date: "2023-09-08" },
  { num: 91, stage: "3rd", t1: "United States", t2: "Canada", label1: "Loser Game 89", label2: "Loser Game 90", score: [118, 127], venue: "moa", ko: "2023-09-10T16:30:00+08:00", date: "2023-09-10" },
  { num: 92, stage: "Final", t1: "Germany", t2: "Serbia", label1: "Winner Game 89", label2: "Winner Game 90", score: [83, 77], venue: "moa", ko: "2023-09-10T20:40:00+08:00", date: "2023-09-10" },
]

export function officialGames() {
  return RAW_GAMES.map((g) => ({ ...g, tbdTip: g.ko === null }))
}

export const OFFICIAL = officialGames()
