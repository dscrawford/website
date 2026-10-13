import { teamPath } from './leagues.js'

// Logo, abbreviation and full name of a team in a rankings or standings
// row, linking to its page
export default function TeamCell({ team, leagueKey, navigate }) {
  const href = team.id ? teamPath(leagueKey, team.id) : null
  const abbreviation = href ? (
    <a
      className="team-cell-link"
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
    <span className="team-cell">
      {team.logo && <img className="team-logo" src={team.logo} alt="" loading="lazy" width="20" height="20" />}
      {abbreviation}
      <span className="team-cell-name">{team.name}</span>
    </span>
  )
}
