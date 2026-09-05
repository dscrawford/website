import { memo, useEffect, useRef } from 'react'
import { formatDate } from './gameTime.js'
import { focusIndex } from './scheduleFocus.js'
import './TeamSchedule.css'

// Rows to keep in view above the focused game
const ROWS_BEFORE = 4
const NO_GAMES = Object.freeze([])

const ScheduleRow = memo(function ScheduleRow({ game, current }) {
  const hasScore = game.teamScore !== null && game.opponentScore !== null
  const unplayed = game.state === 'post' && !hasScore
  return (
    <li className={`sched-row${current ? ' sched-row--current' : ''}`} aria-current={current ? 'true' : undefined}>
      <span className="sched-date">{formatDate(game.date)}</span>
      <span className="sched-opp">
        {game.home || game.neutral ? 'vs' : '@'} {game.opponent.abbreviation}
      </span>
      <span className="sched-score">
        {hasScore && `${game.teamScore}-${game.opponentScore}`}
        {unplayed && <span className="sched-detail">{game.detail}</span>}
      </span>
      <span className="sched-slot">
        {game.result && <span className={`sched-result sched-result--${game.result.toLowerCase()}`}>{game.result}</span>}
        {game.state === 'in' && <span className="sched-live">LIVE</span>}
      </span>
    </li>
  )
})

function TeamSchedule({ schedule, loading, error, onRetry, currentGameId, record }) {
  const listRef = useRef(null)
  const games = schedule?.games ?? NO_GAMES
  const focused = focusIndex(games, currentGameId)

  useEffect(() => {
    const list = listRef.current
    const target = list?.children[Math.max(0, focused - ROWS_BEFORE)]
    if (!target) return
    const top = target.offsetTop - list.offsetTop
    if (typeof list.scrollTo === 'function') list.scrollTo({ top })
    else list.scrollTop = top
  }, [games, focused])

  const abbreviation = schedule?.team?.abbreviation ?? ''
  // Schedules for leagues out of season carry no record; the scoreboard's does
  const shownRecord = schedule?.team?.record ?? record ?? null

  return (
    <section className="sched" aria-label={`${abbreviation} schedule`.trim()}>
      <header className="sched-head">
        <span className="sched-team">
          {abbreviation}
          {shownRecord && <span className="sched-record">{shownRecord}</span>}
        </span>
        {schedule?.season && <span className="sched-season">{schedule.season}</span>}
      </header>
      {loading && <p className="sched-status">Loading schedule...</p>}
      {error && (
        <p className="sched-status">
          Unable to load schedule.{' '}
          <button type="button" className="sched-retry" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      {!loading && !error && games.length === 0 && <p className="sched-status">No games yet.</p>}
      {games.length > 0 && (
        <ol ref={listRef} className="sched-list">
          {games.map((game, i) => (
            <ScheduleRow key={game.id ?? i} game={game} current={i === focused} />
          ))}
        </ol>
      )}
    </section>
  )
}

export default memo(TeamSchedule)
