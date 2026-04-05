import TeamRow from './TeamRow.jsx'
import StatusBadge from './StatusBadge.jsx'
import BroadcastBadge from './BroadcastBadge.jsx'
import './GameCard.css'

export default function GameCard({ game }) {
  if (!game) return null

  const { homeTeam, awayTeam, status, broadcasts } = game
  const isLiveOrFinal = status.state === 'in' || status.state === 'post'
  const homeWinning = isLiveOrFinal && homeTeam.score > awayTeam.score
  const awayWinning = isLiveOrFinal && awayTeam.score > homeTeam.score

  return (
    <div className="game-card">
      <div className="game-teams">
        <TeamRow team={awayTeam} isWinning={awayWinning} />
        <TeamRow team={homeTeam} isWinning={homeWinning} />
      </div>
      <div className="game-footer">
        <StatusBadge status={status} />
        <BroadcastBadge networks={broadcasts} />
      </div>
    </div>
  )
}
