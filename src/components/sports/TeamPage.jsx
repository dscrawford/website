import TopNav from '../TopNav.jsx'
import TeamSchedule from './TeamSchedule.jsx'
import FavoriteButton from './FavoriteButton.jsx'
import useTeamSchedule from '../../hooks/useTeamSchedule.js'
import { LEAGUE_KEYS, leagueLabel } from './leagues.js'
import './TeamPage.css'

// One team's season: every game played or scheduled, each a link to its
// box score, with a star to keep the team pinned on the scoreboard
export default function TeamPage({ navigate, leagueKey, teamId }) {
  const known = LEAGUE_KEYS.has(leagueKey)
  const { schedule, loading, error, retry } = useTeamSchedule(known ? leagueKey : null, teamId)
  const team = schedule?.team

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
                {schedule?.season && <span className="team-abbr">{schedule.season}</span>}
              </h1>
              {team && (
                <FavoriteButton
                  className="team-fav"
                  team={{ league: leagueKey, id: teamId, abbreviation: team.abbreviation, name: team.name }}
                />
              )}
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
