import TeamRow from './TeamRow.jsx'
import StatusBadge from './StatusBadge.jsx'
import BroadcastBadge from './BroadcastBadge.jsx'
import './GameCard.css'
import { memo } from 'react'

function GameCard({ game, navigate }) {
  if (!game) return null

  const { id, homeTeam, awayTeam, status, broadcasts, startTime } = game
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
      {id && (
        <a
          className="box-score-link"
          href={`/sports/${id}`}
          onClick={(e) => {
            e.preventDefault()
            navigate?.(`/sports/${id}`)
          }}
        >
          BOX SCORE →
        </a>
      )}
    </div>
  )
}

export default memo(GameCard)
