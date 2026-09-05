import TopNav from '../TopNav.jsx'
import TeamRow from './TeamRow.jsx'
import StatusBadge from './StatusBadge.jsx'
import BoxScore from './BoxScore.jsx'
import SchedulePanel from './SchedulePanel.jsx'
import { formatMatchup, formatVenue } from './gameVenue.js'
import useSportsData from '../../hooks/useSportsData.js'
import useBoxScore from '../../hooks/useBoxScore.js'
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

export default function GameBoxScorePage({ navigate, gameId }) {
  const { leagues, loading: scoresLoading } = useSportsData()
  const { leagueKey, label, sport, game } = findGame(leagues, gameId)
  const { boxScore, loading, error, retry } = useBoxScore(leagueKey, gameId)

  const notFound = !scoresLoading && leagues && !game

  return (
    <div className="sports-page">
      <TopNav navigate={navigate} />
      <div className="sports-content game-page">
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

        {scoresLoading && !leagues && <p className="sports-status">Loading game...</p>}
        {notFound && (
          <p className="sports-status">Game not found. It may no longer be on the scoreboard.</p>
        )}

        {game && (
          <>
            <p className="game-page-league">{label}</p>
            <div className="game-page-header">
              <div className="game-teams">
                <TeamRow team={game.awayTeam} isWinning={game.awayTeam.score > game.homeTeam.score} />
                <TeamRow team={game.homeTeam} isWinning={game.homeTeam.score > game.awayTeam.score} />
              </div>
              <StatusBadge status={game.status} startTime={game.startTime} />
              <p className="game-page-venue">
                <span className="game-page-matchup">{formatMatchup(game)}</span>
                {game.venue && <span className="game-page-stadium">{formatVenue(game.venue)}</span>}
              </p>
            </div>
            <SchedulePanel leagueKey={leagueKey} game={game} />
            <BoxScore boxScore={boxScore} sport={sport} loading={loading} error={error} onRetry={retry} />
          </>
        )}
      </div>
    </div>
  )
}
