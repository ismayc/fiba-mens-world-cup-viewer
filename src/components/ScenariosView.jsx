import { useState } from 'react'
import { TEAMS, FLAG_BY_TEAM } from '../data/teams.js'
import { computeQualification, ADVANCING_PER_GROUP } from '../utils/qualification.js'
import { projectKnockout } from '../utils/asItStands.js'
import { softTiebreaks, TIEBREAK_LABEL } from '../utils/tiebreakNotes.js'
import ScalesIcon from './ScalesIcon.jsx'
import {
  remainingGroupGames,
  applyScenarioPicks,
  unpickedCount,
  possibleOrderings,
  pickOutcome,
  PICK_SCORES,
} from '../utils/scenarios.js'

function Stepper({ value, onChange, label }) {
  /* v8 ignore next -- unreachable: a stepper only renders for a pick that is already a [home, away] pair of numbers */
  const v = value ?? 0
  return (
    <span className="sc-stepper">
      <button type="button" className="sc-step" onClick={() => onChange(Math.max(0, v - 1))} disabled={v <= 0} aria-label={`${label} minus`}>−</button>
      <span className="sc-step-val">{v}</span>
      <button type="button" className="sc-step" onClick={() => onChange(v + 1)} aria-label={`${label} plus`}>+</button>
    </span>
  )
}

function FixturePicker({ match, pick, onQuick, onScore }) {
  const outcome = pickOutcome(pick)
  const set = Array.isArray(pick)
  return (
    <div className="sc-fixture">
      <div className="sc-fx-line">
        <span className={`sc-fx-team${outcome === 'home' ? ' sc-win' : ''}`}>
          {FLAG_BY_TEAM[match.t1] || '•'} {match.t1}
        </span>
        <div className="sc-fx-buttons" role="group" aria-label={`${match.t1} vs ${match.t2} result`}>
          {/* Two buttons, not three. Basketball plays overtime until someone
              wins, so there is no draw to pick — a level score is not a possible
              result and offering one would build a board the ranking engine
              treats as a data error. */}
          <button type="button" className={`sc-pick${outcome === 'home' ? ' active' : ''}`} onClick={() => onQuick(match.num, 'home')} title={`${match.t1} win`}>W</button>
          <button type="button" className={`sc-pick${outcome === 'away' ? ' active' : ''}`} onClick={() => onQuick(match.num, 'away')} title={`${match.t2} win`}>W</button>
        </div>
        <span className={`sc-fx-team sc-fx-right${outcome === 'away' ? ' sc-win' : ''}`}>
          {match.t2} {FLAG_BY_TEAM[match.t2] || '•'}
        </span>
      </div>
      {set && (
        <div className="sc-score">
          <Stepper value={pick[0]} onChange={(n) => onScore(match.num, [n, pick[1]])} label={`${match.t1} points`} />
          <span className="sc-score-dash">{pick[0]}–{pick[1]}</span>
          <Stepper value={pick[1]} onChange={(n) => onScore(match.num, [pick[0], n])} label={`${match.t2} points`} />
        </div>
      )}
    </div>
  )
}

function ProjectedTable({ rows, decided, ties }) {
  return (
    <table className="sc-table">
      <thead>
        <tr>
          <th className="col-team">Projected {decided ? 'final' : 'order'}</th>
          <th>P</th><th title="Point difference">PD</th><th className="col-pts" title="FIBA points: 2 for a win, 1 for a loss">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const tie = ties.get(r.name)
          return (
            <tr key={r.name} className={r.rank <= ADVANCING_PER_GROUP ? 'qualifies' : ''}>
              <td className="col-team">
                <span className="rank">{r.rank}</span>
                <span className="team-flag">{r.flag}</span>
                <span className="row-team">{r.name}</span>
                {tie && (
                  <span
                    className="sc-tiebreak"
                    title={`Level with ${tie.vs} on points, head-to-head, point difference and points scored — separated by ${TIEBREAK_LABEL[tie.reason]}`}
                    aria-label={`Separated from ${tie.vs} by ${TIEBREAK_LABEL[tie.reason]}`}
                  >
                    <ScalesIcon />
                  </span>
                )}
                {r.rank <= ADVANCING_PER_GROUP && (
                  <span className="sc-tag sc-adv">
                    {r.rank === 1 ? 'wins group → 2nd round' : 'advances → 2nd round'}
                  </span>
                )}
              </td>
              <td>{r.P}</td>
              <td>{r.PD > 0 ? `+${r.PD}` : r.PD}</td>
              <td className="col-pts">{r.Pts}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// "As it stands → second round" line for a projected qualifier: the top two of a
// first-round group carry into a specific second-round group. Which group is fixed
// by the draw (A & B → I, and so on), so there is no opponent to lock; the only
// open question the picks settle is WHICH two teams finish top two.
function EntryLine({ label, dest }) {
  return (
    <li className="sc-entry-row">
      <span className="sc-entry-pos">{label}</span>
      <span className="sc-entry-team">{FLAG_BY_TEAM[dest.team]} {dest.team}</span>
      <span className="sc-entry-vs">→</span>
      <span className="sc-entry-opp">2nd round · Group {dest.r2group}</span>
    </li>
  )
}

// Representative scorelines for the two quick buttons; the steppers then let
// the user set any exact score, which matters because point difference is a
// FIBA tie-breaker and a one-point win ranks differently from a thirty-point one.
const QUICK = PICK_SCORES

export default function ScenariosView({ matches }) {
  const [picks, setPicks] = useState({})

  // Quick W/D/W: set a representative score, or clear it if that outcome is
  // already selected (toggle off).
  const onQuick = (num, outcome) =>
    setPicks((p) => {
      if (pickOutcome(p[num]) === outcome) {
        const { [num]: _drop, ...rest } = p
        return rest
      }
      return { ...p, [num]: QUICK[outcome] }
    })
  const onScore = (num, score) => setPicks((p) => ({ ...p, [num]: score }))
  const clear = () => setPicks({})

  const remaining = remainingGroupGames(matches)
  const groupsInPlay = Object.keys(remaining).sort()
  const synthetic = applyScenarioPicks(matches, picks)
  const qual = computeQualification(synthetic)
  const proj = projectKnockout(synthetic).r1
  const leftToPick = unpickedCount(matches, picks)
  const pickedAny = Object.keys(picks).length > 0

  if (!groupsInPlay.length) {
    return (
      <div className="sc-empty">
        <p>🏁 Every group is decided — no scenarios left to explore.</p>
        <p className="sc-empty-sub">Head to the Bracket to see the final-phase matchups.</p>
      </div>
    )
  }

  return (
    <div className="scenarios">
      <div className="sc-intro">
        <p>
          Pick the winner of each remaining group game to see exactly how the standings and the
          final phase would shake out. Deterministic — no predictions, just the consequences of
          the results you choose.
        </p>
        <div className="sc-intro-bar">
          <span className="sc-left">{leftToPick} game{leftToPick === 1 ? '' : 's'} still open</span>
          {pickedAny && (
            <button className="sc-clear" onClick={clear}>Clear picks</button>
          )}
        </div>
      </div>

      <div className="sc-grid">
        {groupsInPlay.map((g) => {
          const open = remaining[g]
          const allPicked = open.every((m) => Array.isArray(picks[m.num]))
          const gp = proj[g]
          // Distinct final standings still reachable given the results set so far.
          const { count, decided } = possibleOrderings(g, synthetic)
          // Placings that could only be decided by a drawing of lots.
          const ties = softTiebreaks(TEAMS[g], synthetic)
          return (
            <div className="sc-card" key={g}>
              <h3 className="group-title">
                Group {g}
                {/* No "N to pick" fallback. The football sibling needs one
                    because its scoreline enumeration can exceed its budget and
                    return a null count; this one walks win/loss outcomes only,
                    which is at most 64 for a group, so a count is ALWAYS
                    available and that arm was dead. See utils/scenarios.js. */}
                <span className={`sc-card-state${decided ? ' sc-decided' : ''}`}>
                  {decided ? 'order decided' : `${count} possible orders`}
                </span>
              </h3>

              <div className="sc-fixtures">
                {open.map((m) => (
                  <FixturePicker key={m.num} match={m} pick={picks[m.num]} onQuick={onQuick} onScore={onScore} />
                ))}
              </div>

              <ProjectedTable rows={qual.groups[g]} decided={allPicked} ties={ties} />

              <div className="sc-entry">
                <div className="sc-entry-title">Projected second round</div>
                <ul className="sc-entry-list">
                  <EntryLine label="1st" dest={gp.first} />
                  <EntryLine label="2nd" dest={gp.second} />
                </ul>
              </div>
            </div>
          )
        })}
      </div>

      <p className="sc-foot">
        The two W buttons set a representative eight-point win; use the − / + steppers to set an
        exact score so point-difference tie-breakers resolve precisely. There is no draw button —
        basketball plays overtime until someone wins. “Possible orders” counts the distinct final
        standings still reachable for a group given the results you’ve set. The top two of each
        first-round group carry into a fixed second-round group (A &amp; B → I, C &amp; D → J,
        E &amp; F → K, G &amp; H → L), taking their head-to-head result with them. A <ScalesIcon />{' '}
        marks a placing that could only be decided by a drawing of lots — once points, head-to-head,
        point difference and points scored are all level (hover it for the decider).
      </p>
    </div>
  )
}
