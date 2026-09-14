# News

Dated changelog, newest first.

## 2026-09-14

- **New viewer: FIBA Men's Basketball World Cup 2027 (Qatar).** Grown from the
  `fiba-womens-world-cup-viewer` sibling and rewritten for the men's format, which
  is unlike anything else in the family: 32 teams, two group stages with a
  head-to-head carryover, and an eight-team knockout.
- **The format engine.** Eight first-round groups A-H (top two advance) feed four
  second-round groups I-L (A&B → I, C&D → J, E&F → K, G&H → L). The two
  co-qualifiers' first-round game carries over into the second-round table, so a
  second-round group is a four-team round-robin whose six games span two rounds.
  The top two of each second-round group reach a balanced eight-team knockout with
  FIBA's 2023 crossover (I↔L, J↔K), so two teams from one second-round group can
  only meet again in the Final.
- **Placeholder draw.** The real draw is not held until spring 2027, and only Qatar
  (host) and Türkiye have qualified so far. The app ships a full 92-game synthetic
  schedule with an illustrative 32-team field so the format can be explored now;
  every screen is labeled as provisional. Real teams, fixtures and venues drop in
  when FIBA publishes them.
- **Views.** Schedule, Week, Groups (both group stages), Scenarios (a first-round
  what-if) and the knockout Bracket. Qatar-maroon accent; basketball-on-dark app
  icon and share card.
- **Classification games** (17th-32nd and 5th-8th) appear in the schedule for
  completeness but are not bracketed: the engine ranks the top 16 seriously.
