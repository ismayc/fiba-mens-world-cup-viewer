# News

Dated changelog, newest first.

## 2026-09-14

- **New viewer: the 2023 FIBA Men's Basketball World Cup.** Grown from the
  `fiba-womens-world-cup-viewer` sibling and rebuilt for the men's format, which is
  unlike anything else in the family: 32 teams, two group stages with a carryover,
  and an eight-team knockout. It carries the real, completed tournament, co-hosted
  by the Philippines, Japan and Indonesia across five arenas on three timezones,
  won by Germany over Serbia. Every team, group, score, date and venue is verified
  against Wikipedia's own tables.
- **The format engine.** Eight first-round groups A-H (top two advance) feed four
  second-round groups I-L (A&B to I, C&D to J, E&F to K, G&H to L). Each qualifier
  carries its FULL first-round record forward (all five group-stage games count),
  then plays two new games. The top two of each second-round group reach a balanced
  eight-team knockout with FIBA's 2023 crossover (I with J, K with L), so two teams
  from one second-round group can only meet again in the Final.
- **Two engine bugs, caught by building the real tournament.** Loading the real 2023
  results surfaced two defects the synthetic placeholder never could: the
  second-round table was counting only the games among the four members (three per
  team) instead of each team's full five-game record, and the knockout crossover was
  wired I with L / J with K instead of I with J / K with L. Both are fixed; the
  engine now reproduces the real 2023 standings and bracket exactly, and both cases
  are frozen into the test suite as regression fixtures.
- **Views.** Schedule, Week, Groups (both group stages), Scenarios (a first-round
  what-if) and the knockout Bracket. Basketball-on-dark app icon and share card.
- **Classification games** (17th-32nd and 5th-8th) appear in the schedule for
  completeness but are not bracketed: the engine ranks the top 16 seriously.
