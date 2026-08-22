import './TeamRow.css'

export default function TeamRow({ team, isWinning }) {
  if (!team) return null

  return (
    <div className={`team-row${isWinning ? ' team-winning' : ''}`}>
      {team.logo && (
        <img
          className="team-logo"
          src={team.logo}
          alt={team.abbreviation}
          loading="lazy"
          width="20"
          height="20"
        />
      )}
      <span className="team-name">{team.abbreviation}</span>
      <span className="team-score">{team.score}</span>
    </div>
  )
}
