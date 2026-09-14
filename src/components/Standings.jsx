import { useState } from 'react'
import { TEAMS, FLAG_BY_TEAM } from '../data/teams.js'
import {
  computeQualification,
  rowStatus,
  rowStatusR2,
  FIRST_ROUND_GROUPS,
  SECOND_ROUND_GROUPS,
} from '../utils/qualification.js'
import { computeSecondRound } from '../utils/secondRound.js'
import { clinchBadge, groupPositionBounds, groupPositionBoundsR2, computeClinchR2 } from '../utils/clinch.js'
import { projectKnockout } from '../utils/asItStands.js'
import { lockedOpponent } from '../utils/opponentClinch.js'
import { softTiebreaks, TIEBREAK_LABEL } from '../utils/tiebreakNotes.js'
import { useFollow } from '../context/follow.jsx'
import GroupGamesModal from './GroupGamesModal.jsx'
import ScalesIcon from './ScalesIcon.jsx'
import { LEAGUE } from '../config/league.js'

// Position badges. The first-round table marks advance-to-second-round vs out; the
// second-round table marks advance-to-quarter-finals vs out. Both top two advance,
// so there is no winner-only distinction to draw the way the women's edition did.
const STATUS_BADGE = {
  r2: { cls: 'q-in', label: '✓', title: 'Advances to the second round' },
  ko: { cls: 'q-won', label: '✓', title: 'Advances to the quarter-finals' },
  out: { cls: 'q-out', label: '✕', title: 'Eliminated' },
}

function Star({ name }) {
  const { isFollowed, toggle } = useFollow()
  const on = isFollowed(name)
  return (
    <button className={`star${on ? ' on' : ''}`} onClick={() => toggle(name)} aria-pressed={on}
      aria-label={on ? `Unfollow ${name}` : `Follow ${name}`}
      title={on ? `Unfollow ${name}` : `Follow ${name}`}>
      {on ? '★' : '☆'}
    </button>
  )
}

// "As it stands" for a FIRST-ROUND group: the current top two, and which
// second-round group they would carry into. There is no single opponent to name
// (each plays both qualifiers from the paired group), so this just names the
// destination group.
function AsItStandsR1({ proj }) {
  const row = (label, d) => (
    <li className="ais-row" key={label}>
      <span className="ais-pos">{label}</span>
      <span className="ais-team">{FLAG_BY_TEAM[d.team]} {d.team}</span>
      <span className="ais-vs">→</span>
      <span className="ais-opp">2nd round · Group {d.r2group}</span>
    </li>
  )
  return (
    <div className="as-it-stands">
      <div className="ais-title">As it stands → second round</div>
      <ul className="ais-list">
        {row('1st', proj.first)}
        {row('2nd', proj.second)}
      </ul>
    </div>
  )
}

// "As it stands" for a SECOND-ROUND group: the current top two and their projected
// quarter-final matchup. The opponent is another second-round group's placing on
// the crossover, so it can be named from the live tables, or shown as a pending
// slot while that group is unresolved.
function AsItStandsR2({ proj, onGoToMatch }) {
  const row = (label, d) => {
    /* v8 ignore next -- the opponentLabel fallback is unreachable here: AsItStandsR2 only renders when all four second-round groups are seeded, so the crossover opponent is always resolved to a real team */
    const oppText = d.opponent ? `${FLAG_BY_TEAM[d.opponent]} ${d.opponent}` : d.opponentLabel
    return (
      <li className="ais-row" key={label}>
        <span className="ais-pos">{label}</span>
        <span className="ais-team">{FLAG_BY_TEAM[d.team]} {d.team}</span>
        <span className="ais-vs">{LEAGUE.homeAwaySep}</span>
        <span className="ais-opp">{oppText}</span>
        <span className="ais-round" title="Quarter-final">QF</span>
        {onGoToMatch ? (
          <button
            type="button"
            className="ais-match ais-match-link"
            onClick={() => onGoToMatch(d.gameNum)}
            title={`Show Game ${d.gameNum} on the Bracket`}
          >
            G{d.gameNum}
          </button>
        ) : (
          <span className="ais-match">G{d.gameNum}</span>
        )}
      </li>
    )
  }
  return (
    <div className="as-it-stands">
      <div className="ais-title">As it stands → quarter-finals</div>
      <ul className="ais-list">
        {row('1st', proj.first)}
        {row('2nd', proj.second)}
      </ul>
    </div>
  )
}

// ⚖️ shown when a placing could only be decided by a drawing of lots.
function TieMark({ tie }) {
  if (!tie) return null
  return (
    <span
      className="tiebreak-mark"
      title={`Level with ${tie.vs} on points, head-to-head, point difference and points scored — separated by ${TIEBREAK_LABEL[tie.reason]}`}
      aria-label={`Separated from ${tie.vs} by ${TIEBREAK_LABEL[tie.reason]}`}
    >
      <ScalesIcon />
    </span>
  )
}

// "1–4" while outcomes remain open; collapses to the bare position (gold) once
// locked.
function FinishRange({ range }) {
  if (range.best === range.worst) {
    return <span className="finish finish-locked">{range.best}</span>
  }
  return (
    <span className="finish">
      {range.best}–{range.worst}
    </span>
  )
}

// One group table, for either stage. `stage` is 'R1' or 'R2'; it selects the
// status badge, the "advancing" tint and the projection panel.
function GroupTable({
  group, stage, rows, complete, clinch, finish, asItStands, onGoToMatch,
  onSelectTeam, ties, liveTeams, pausedTeams,
}) {
  const { isFollowed } = useFollow()
  const played = complete || rows.some((r) => r.P > 0)
  const groupLive = rows.some((r) => liveTeams.has(r.name))
  const pauseRow = rows.find((r) => pausedTeams.has(r.name))
  const pauseLabel = pauseRow ? pausedTeams.get(pauseRow.name) : null
  const statusOf = (r) => (stage === 'R2' ? rowStatusR2(r, complete) : rowStatus(r, complete))
  return (
    <div className="group-card">
      <h3 className="group-title">
        <button
          type="button"
          className="group-title-btn"
          onClick={() => onSelectTeam(group, null)}
          title={`Show all Group ${group} games & results`}
        >
          Group {group}
        </button>
        {groupLive &&
          (pauseLabel ? (
            <span className="group-delayed" title={`A game in this group is ${pauseLabel.toLowerCase()} — standings are provisional`}>
              ⏸ {pauseLabel.toUpperCase()}
            </span>
          ) : (
            <span className="group-live" title="A game in this group is in progress — standings are provisional">
              ● LIVE
            </span>
          ))}
      </h3>
      <table className="standings-table">
        <thead>
          <tr>
            <th className="col-team">Team</th>
            <th>P</th><th>W</th><th>L</th>
            <th title="Points scored">PF</th>
            <th title="Points allowed">PA</th>
            <th title="Point difference">PD</th>
            <th className="col-pts" title="FIBA points: 2 for a win, 1 for a loss">Pts</th>
            <th className="col-finish" title="Final group positions still arithmetically possible — a single number means the finish is locked">Fin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const clinched = clinchBadge(clinch?.[r.name])
            const status = statusOf(r)
            const badge = status && STATUS_BADGE[status]
            const c = clinch?.[r.name]
            const advancing = status === 'r2' || status === 'ko' || c === 'won-group' || c === 'advanced'
            const rowCls = c === 'eliminated' ? 'eliminated' : advancing ? 'qualifies' : ''
            return (
              <tr key={r.name} className={rowCls}>
                <td className="col-team">
                  <span className="rank">{r.rank}</span>
                  <Star name={r.name} />
                  <span className="team-flag">{r.flag}</span>
                  <button
                    type="button"
                    className={`row-team row-team-btn${isFollowed(r.name) ? ' followed' : ''}`}
                    onClick={() => onSelectTeam(group, r.name)}
                    title={`Show Group ${group} games & results`}
                  >
                    {r.name}
                  </button>
                  <TieMark tie={ties?.get(r.name)} />
                  {liveTeams.has(r.name) && (
                    <span
                      className={`row-live-dot${pausedTeams.has(r.name) ? ' delayed' : ''}`}
                      title={pausedTeams.has(r.name) ? `${pausedTeams.get(r.name)} — score is provisional` : 'Playing now — score is provisional'}
                    >
                      ●
                    </span>
                  )}
                  {clinched ? (
                    <span className={`q-badge q-wide ${clinched.cls}`} title={clinched.title}>
                      {clinched.label} {clinched.text}
                    </span>
                  ) : (
                    badge && (
                      <span className={`q-badge ${badge.cls}`} title={badge.title}>
                        {badge.label}
                      </span>
                    )
                  )}
                </td>
                <td>{r.P}</td><td>{r.W}</td><td>{r.L}</td>
                <td>{r.PF}</td><td>{r.PA}</td>
                <td>{r.PD > 0 ? `+${r.PD}` : r.PD}</td>
                <td className="col-pts">{r.Pts}</td>
                <td className="col-finish"><FinishRange range={finish[r.name]} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!played && <p className="group-note">No games played yet</p>}
      {played && asItStands &&
        (stage === 'R2'
          ? <AsItStandsR2 proj={asItStands} onGoToMatch={onGoToMatch} />
          : <AsItStandsR1 proj={asItStands} />)}
    </div>
  )
}

export default function Standings({ matches, tz, hideScores, clinch, onGoToMatch }) {
  const [revealed, setRevealed] = useState(false)
  const [groupGames, setGroupGames] = useState(null)
  const onSelectTeam = (group, team) => setGroupGames({ group, team })
  const [showProjection, setShowProjection] = useState(() => {
    try {
      return localStorage.getItem(`${LEAGUE.storageKey}:asItStands`) !== '0'
    } catch {
      return true
    }
  })
  const toggleProjection = () =>
    setShowProjection((v) => {
      const next = !v
      try {
        localStorage.setItem(`${LEAGUE.storageKey}:asItStands`, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })

  if (hideScores && !revealed) {
    return (
      <div className="standings-hidden">
        <p>🙈 Standings are hidden in spoiler-free mode.</p>
        <button className="reveal-btn" onClick={() => setRevealed(true)}>Reveal standings</button>
      </div>
    )
  }

  const qual = computeQualification(matches)
  const sr = computeSecondRound(matches)
  const clinchR2 = computeClinchR2(matches)
  const proj = projectKnockout(matches)
  const finish = groupPositionBounds(matches)
  const finishR2 = groupPositionBoundsR2(matches)
  const boundsR2 = finishR2

  // For a team that has a locked quarter-final opponent, its next game, for the
  // group-games pop-up. Only promised once the matchup is mathematically fixed.
  const teamKnockout = (team) => {
    if (!team) return null
    const locked = lockedOpponent(matches, team, boundsR2)
    if (!locked) return null
    return {
      status: 'ko',
      opponent: locked.opponent,
      opponentLabel: null,
      round: locked.round,
      matchNum: locked.gameNum,
      settled: true,
    }
  }

  // Teams currently playing a group-stage game (first or second round): the tables
  // reflect their in-progress score, so blink them to show it is provisional.
  const liveTeams = new Set()
  const pausedTeams = new Map()
  for (const m of matches) {
    if ((m.stage === 'R1' || m.stage === 'R2') && m.live) {
      liveTeams.add(m.t1)
      liveTeams.add(m.t2)
      if (m.live.delayed) {
        const lbl = m.live.label || 'Delayed'
        pausedTeams.set(m.t1, lbl)
        pausedTeams.set(m.t2, lbl)
      }
    }
  }

  return (
    <>
      <p className="standings-tip">
        💡 Tip: click a <strong>team name</strong> to see that team’s group games —
        played and upcoming — or a <strong>group title</strong> for the whole
        group’s schedule.
      </p>
      <p className="standings-legend">
        <span className="legend-swatch" /> Top two of each group advance ·{' '}
        <span
          className="legend-tb"
          tabIndex={0}
          role="note"
          aria-label="FIBA tie-breakers: points (2 for a win, 1 for a loss), then head-to-head points, head-to-head point difference and head-to-head points scored among the tied teams, then overall point difference, then overall points scored, then a drawing of lots, which this app shows as FIBA World Ranking order"
          data-tip="Tie-breakers: points (W 2 / L 1) → head-to-head points → h2h point difference → h2h points scored → overall point difference → overall points scored → drawing of lots, shown here as world-ranking order"
        >
          tie-breakers
        </span>{' '}
        · <span className="q-badge c-won">🥇 Won group</span> /{' '}
        <span className="q-badge c-in">✅ Advanced</span> /{' '}
        <span className="q-badge c-out">❌ Out</span> mark mathematically clinched outcomes ·{' '}
        <span className="finish">Fin 1–4</span> the group positions still arithmetically
        possible (a single gold number means the finish is locked) ·{' '}
        teams nothing on the court separates are listed in{' '}
        <strong>FIBA World Ranking</strong> order, which is where an unplayed group’s
        order comes from; FIBA itself would draw lots.
      </p>
      <div className="standings-toolbar">
        <button
          className="ais-toggle"
          onClick={toggleProjection}
          aria-pressed={showProjection}
          title="Show or hide the projected next-stage matchups under each group"
        >
          {showProjection ? '▾ Hide “As it stands”' : '▸ Show “As it stands”'}
        </button>
      </div>

      <h2 className="stage-heading">First round</h2>
      <div className="standings-grid">
        {FIRST_ROUND_GROUPS.map((g) => (
          <GroupTable
            key={g}
            group={g}
            stage="R1"
            rows={qual.groups[g]}
            complete={qual.completion[g]}
            clinch={clinch}
            finish={finish}
            asItStands={showProjection ? proj.r1[g] : null}
            onGoToMatch={onGoToMatch}
            onSelectTeam={onSelectTeam}
            ties={softTiebreaks(TEAMS[g], matches)}
            liveTeams={liveTeams}
            pausedTeams={pausedTeams}
          />
        ))}
      </div>

      <h2 className="stage-heading">Second round</h2>
      {sr.allSeeded ? (
        <div className="standings-grid">
          {SECOND_ROUND_GROUPS.map((key) => (
            <GroupTable
              key={key}
              group={key}
              stage="R2"
              rows={sr.groups[key]}
              complete={sr.completion[key]}
              clinch={clinchR2}
              finish={finishR2}
              asItStands={showProjection ? proj.r2[key] : null}
              onGoToMatch={onGoToMatch}
              onSelectTeam={onSelectTeam}
              ties={softTiebreaks(sr.members[key], matches)}
              liveTeams={liveTeams}
              pausedTeams={pausedTeams}
            />
          ))}
        </div>
      ) : (
        <p className="stage-pending">
          The four second-round groups (I–L) are seeded once the first round
          finishes. Each merges two first-round groups (A&amp;B → I, C&amp;D → J,
          E&amp;F → K, G&amp;H → L); the two co-qualifiers’ head-to-head result
          carries over.
        </p>
      )}

      {groupGames && (
        <GroupGamesModal
          group={groupGames.group}
          team={groupGames.team}
          matches={matches}
          tz={tz}
          hideScores={hideScores}
          knockout={teamKnockout(groupGames.team)}
          onClose={() => setGroupGames(null)}
        />
      )}
    </>
  )
}
