import { memo } from 'react'
import StatHeader from './StatHeader.jsx'
import { describeStat } from './statGlossary.js'
import './BoxScore.css'

function StatGroup({ group, sport }) {
  return (
    <div className="box-group">
      <h4 className="box-group-name">{group.name}</h4>
      <table className="box-table">
        <thead>
          <tr>
            <th className="box-player-col">PLAYER</th>
            {group.labels.map((label, i) => (
              <StatHeader
                key={i}
                label={label}
                info={describeStat({ sport, group: group.name, label, fallbackName: group.descriptions?.[i] })}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {group.players.map((player, i) => (
            <tr key={i}>
              <td className="box-player-col">
                {player.shortName}
                {player.position && <span className="box-pos"> {player.position}</span>}
              </td>
              {group.labels.map((_, col) => (
                <td key={col}>{player.stats[col] ?? ''}</td>
              ))}
            </tr>
          ))}
          {group.totals.some((t) => t !== '') && (
            <tr className="box-totals">
              <td className="box-player-col">TEAM</td>
              {group.labels.map((_, col) => (
                <td key={col}>{group.totals[col] ?? ''}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function BoxScore({ boxScore, sport, loading, error, onRetry }) {
  if (loading) {
    return <p className="box-status">Loading box score...</p>
  }
  if (error) {
    return (
      <p className="box-status">
        Unable to load box score.{' '}
        <button type="button" className="box-retry" onClick={onRetry}>
          Retry
        </button>
      </p>
    )
  }
  if (!boxScore || boxScore.teams.length === 0) {
    return <p className="box-status">Box score not available yet.</p>
  }
  return (
    <div className="box-score">
      {boxScore.teams.map((team, i) => (
        <div key={i} className="box-team">
          <h3 className="box-team-name">{team.name}</h3>
          {team.groups.map((group, j) => (
            <StatGroup key={j} group={group} sport={sport} />
          ))}
        </div>
      ))}
    </div>
  )
}

export default memo(BoxScore)
