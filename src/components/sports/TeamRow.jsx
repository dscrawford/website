import './TeamRow.css'

// `href` turns the team name into a link to its page; `navigate` keeps it
// client-side
export default function TeamRow({ team, isWinning, href, navigate }) {
  if (!team) return null

  const name = href ? (
    <a
      className="team-link"
      href={href}
      onClick={(e) => {
        e.preventDefault()
        navigate?.(href)
      }}
    >
      {team.abbreviation}
    </a>
  ) : (
    team.abbreviation
  )

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
      <span className="team-name">
        {name}
        {team.record && <span className="team-record">{team.record}</span>}
      </span>
      <span className="team-score">{team.score}</span>
    </div>
  )
}
