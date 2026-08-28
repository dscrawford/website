import TeamRow from './TeamRow.jsx'
import StatusBadge from './StatusBadge.jsx'
import BroadcastBadge from './BroadcastBadge.jsx'
import BoxScore from './BoxScore.jsx'
import useBoxScore from '../../hooks/useBoxScore.js'
import './GameCard.css'
import { memo, useState } from 'react'

function GameCard({ game, leagueKey }) {
  const [expanded, setExpanded] = useState(false)
  const { boxScore, loading, error, ensureLoaded, retry } = useBoxScore(leagueKey, game?.id)

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
      <button
        type="button"
        className="box-score-toggle"
        aria-expanded={expanded}
        onClick={() => {
          const next = !expanded
          if (next) ensureLoaded()
          setExpanded(next)
        }}
      >
        BOX SCORE {expanded ? '▴' : '▾'}
      </button>
      {expanded && (
        <BoxScore boxScore={boxScore} loading={loading} error={error} onRetry={retry} />
      )}
    </div>
  )
}

export default memo(GameCard)
