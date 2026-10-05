import TopNav from '../TopNav.jsx'
import TeamSchedule from './TeamSchedule.jsx'
import FavoriteButton from './FavoriteButton.jsx'
import useTeamSchedule from '../../hooks/useTeamSchedule.js'
import { LEAGUE_KEYS, leagueLabel, seasonOptions, isValidSeason, teamPath } from './leagues.js'
import './TeamPage.css'

// One team's season: every game played or scheduled, each a link to its
// box score, with a star to keep the team pinned on the scoreboard.
// ?season=YYYY shows a past year; absent means the current season.
export default function TeamPage({ navigate, leagueKey, teamId, search = window.location.search }) {
  const known = LEAGUE_KEYS.has(leagueKey)
  const seasons = seasonOptions()
  const requested = new URLSearchParams(search).get('season')
  const season = requested && isValidSeason(requested) && requested !== seasons[0] ? requested : undefined
  const { schedule, loading, error, retry } = useTeamSchedule(known ? leagueKey : null, teamId, season)
  const team = schedule?.team

  const selectSeason = (year) => {
    const base = teamPath(leagueKey, teamId)
    navigate?.(year === seasons[0] ? base : `${base}?season=${year}`)
  }

  return (
    <div className="sports-page">
      <TopNav navigate={navigate} />
      <div className="sports-content team-page">
        <a
          className="game-page-back"
          href="/sports"
          onClick={(e) => {
            e.preventDefault()
            navigate?.('/sports')
          }}
        >
          ← SCOREBOARD
        </a>

        {!known && <p className="sports-status">Unknown league.</p>}

        {known && (
          <>
            <p className="game-page-league">{leagueLabel(leagueKey)}</p>
            <header className="team-head">
              <h1 className="team-title">
                {team?.name ?? (loading ? 'Loading…' : 'Team')}
                {team?.abbreviation && <span className="team-abbr">{team.abbreviation}</span>}
                {team?.record && <span className="team-season-record">{team.record}</span>}
              </h1>
              <div className="team-tools">
                <label className="team-season">
                  <span className="team-season-label">Season</span>
                  <select
                    className="team-season-select"
                    aria-label="Season"
                    value={season ?? seasons[0]}
                    onChange={(e) => selectSeason(e.target.value)}
                  >
                    {seasons.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                {team && (
                  <FavoriteButton
                    className="team-fav"
                    team={{ league: leagueKey, id: teamId, abbreviation: team.abbreviation, name: team.name }}
                  />
                )}
              </div>
            </header>
            <TeamSchedule
              schedule={schedule}
              loading={loading}
              error={error}
              onRetry={retry}
              currentGameId={null}
              leagueKey={leagueKey}
              navigate={navigate}
              full
            />
          </>
        )}
      </div>
    </div>
  )
}
