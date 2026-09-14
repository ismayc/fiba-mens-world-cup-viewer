// Distinct colors for the groups, used to color-code the weekly calendar (and the
// legend). Eight first-round groups (A-H) and four second-round groups (I-L) each
// get their own; knockout and classification games share one accent.
export const GROUP_COLORS = {
  A: '#e6194b',
  B: '#3cb44b',
  C: '#4363d8',
  D: '#f58231',
  E: '#911eb4',
  F: '#42d4f4',
  G: '#f032e6',
  H: '#bfef45',
  I: '#fabed4',
  J: '#469990',
  K: '#dcbeff',
  L: '#9a6324',
}

export const KNOCKOUT_COLOR = '#f4c542'

export function colorForGame(g) {
  return g.stage === 'R1' || g.stage === 'R2' ? GROUP_COLORS[g.group] : KNOCKOUT_COLOR
}
