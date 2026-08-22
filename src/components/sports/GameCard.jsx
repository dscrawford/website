import TeamRow from './TeamRow.jsx'
import StatusBadge from './StatusBadge.jsx'
import BroadcastBadge from './BroadcastBadge.jsx'
import './GameCard.css'
import { memo } from 'react'

function GameCard({ game }) {
  if (!game) return null

  const { homeTeam, awayTeam, status, broadcasts, startTime } = game
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
        <StatusBadge status={status} startTime={startTime} />
        <BroadcastBadge networks={broadcasts} />
      </div>
    </div>
  )
}

export default memo(GameCard)
