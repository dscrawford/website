import TopNav from '../TopNav.jsx'
import TeamRow from './TeamRow.jsx'
import StatusBadge from './StatusBadge.jsx'
import BoxScore from './BoxScore.jsx'
import SchedulePanel from './SchedulePanel.jsx'
import { formatMatchup, formatVenue } from './gameVenue.js'
import useSportsData from '../../hooks/useSportsData.js'
import useBoxScore from '../../hooks/useBoxScore.js'
import { isValidDay, teamPath } from './leagues.js'
import './GameBoxScorePage.css'

// The URL carries only the game id; the league is resolved from the live
// scoreboard data (which also keeps the header score updating)
function findGame(leagues, gameId) {
  if (!leagues) return {}
  for (const [key, data] of Object.entries(leagues)) {
    const game = data?.games?.find((g) => g.id === gameId)
    if (game) return { leagueKey: key, label: data.label, sport: data.sport, game }
  }
  return {}
}

// ?date= names the day a past game was played so it can be found on that
// day's board rather than today's live one
export default function GameBoxScorePage({ navigate, gameId, search = window.location.search }) {
  const dateParam = new URLSearchParams(search).get('date')
  const date = dateParam && isValidDay(dateParam) ? dateParam : undefined
  const { leagues, loading: scoresLoading } = useSportsData(date)
  const { leagueKey, label, sport, game } = findGame(leagues, gameId)
  const { boxScore, loading, error, retry } = useBoxScore(leagueKey, gameId)

  const notFound = !scoresLoading && leagues && !game
  const backHref = date ? `/sports?date=${date}` : '/sports'

  return (
    <div className="sports-page">
      <TopNav navigate={navigate} />
      <div className="sports-content game-page">
        <a
          className="game-page-back"
          href={backHref}
          onClick={(e) => {
            e.preventDefault()
            navigate?.(backHref)
          }}
        >
          ← SCOREBOARD
        </a>

        {scoresLoading && !leagues && <p className="sports-status">Loading game...</p>}
        {notFound && (
          <p className="sports-status">Game not found. It may no longer be on the scoreboard.</p>
        )}

        {game && (
          <>
            <p className="game-page-league">{label}</p>
            <div className="game-page-header">
              <div className="game-teams">
                <TeamRow team={game.awayTeam} isWinning={game.awayTeam.score > game.homeTeam.score} navigate={navigate} href={game.awayTeam.id ? teamPath(leagueKey, game.awayTeam.id) : undefined} />
                <TeamRow team={game.homeTeam} isWinning={game.homeTeam.score > game.awayTeam.score} navigate={navigate} href={game.homeTeam.id ? teamPath(leagueKey, game.homeTeam.id) : undefined} />
              </div>
              <StatusBadge status={game.status} startTime={game.startTime} />
              <p className="game-page-venue">
                <span className="game-page-matchup">{formatMatchup(game)}</span>
                {game.venue && <span className="game-page-stadium">{formatVenue(game.venue)}</span>}
              </p>
            </div>
            <SchedulePanel leagueKey={leagueKey} game={game} navigate={navigate} />
            <BoxScore boxScore={boxScore} sport={sport} loading={loading} error={error} onRetry={retry} />
          </>
        )}
      </div>
    </div>
  )
}
