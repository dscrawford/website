import { memo, useEffect, useRef } from 'react'
import { formatDate, gamePath } from './gameTime.js'
import { focusIndex } from './scheduleFocus.js'
import './TeamSchedule.css'

// Rows to keep in view above the focused game
const ROWS_BEFORE = 4
const NO_GAMES = Object.freeze([])

// With a league, each row links to that game's box score
const ScheduleRow = memo(function ScheduleRow({ game, current, leagueKey, navigate }) {
  const hasScore = game.teamScore !== null && game.opponentScore !== null
  const unplayed = game.state === 'post' && !hasScore
  const href = leagueKey && game.id ? gamePath(game.id, leagueKey, game.date) : null
  const cells = (
    <>
      <span className="sched-date">{formatDate(game.date)}</span>
      <span className="sched-opp">
        {game.home || game.neutral ? 'vs' : '@'} {game.opponent.abbreviation}
        {game.opponentRecord && <span className="sched-opp-record">{game.opponentRecord}</span>}
      </span>
      <span className="sched-score">
        {hasScore && `${game.teamScore}-${game.opponentScore}`}
        {unplayed && <span className="sched-detail">{game.detail}</span>}
      </span>
      <span className="sched-slot">
        {game.result && <span className={`sched-result sched-result--${game.result.toLowerCase()}`}>{game.result}</span>}
        {game.state === 'in' && <span className="sched-live">LIVE</span>}
        {game.record && <span className="sched-row-record">{game.record}</span>}
      </span>
    </>
  )
  return (
    <li className={`sched-row${current ? ' sched-row--current' : ''}${href ? ' sched-row--link' : ''}`} aria-current={current ? 'true' : undefined}>
      {href ? (
        <a
          className="sched-link"
          href={href}
          onClick={(e) => {
            e.preventDefault()
            navigate?.(href)
          }}
        >
          {cells}
        </a>
      ) : (
        cells
      )}
    </li>
  )
})

// `full` lists the whole season instead of a six-row scroller; `teamHref`
// links the header to the team's page
function TeamSchedule({ schedule, loading, error, onRetry, currentGameId, record, leagueKey, navigate, full = false, teamHref }) {
  const listRef = useRef(null)
  const games = schedule?.games ?? NO_GAMES
  const focused = focusIndex(games, currentGameId)

  useEffect(() => {
    if (full) return
    const list = listRef.current
    const target = list?.children[Math.max(0, focused - ROWS_BEFORE)]
    if (!target) return
    const top = target.offsetTop - list.offsetTop
    if (typeof list.scrollTo === 'function') list.scrollTo({ top })
    else list.scrollTop = top
  }, [games, focused, full])

  const abbreviation = schedule?.team?.abbreviation ?? ''
  // Schedules for leagues out of season carry no record; the scoreboard's does
  const shownRecord = schedule?.team?.record ?? record ?? null

  const teamName = teamHref ? (
    <a
      className="sched-team-link"
      href={teamHref}
      onClick={(e) => {
        e.preventDefault()
        navigate?.(teamHref)
      }}
    >
      {abbreviation}
    </a>
  ) : (
    abbreviation
  )

  return (
    <section className={`sched${full ? ' sched--full' : ''}`} aria-label={`${abbreviation} schedule`.trim()}>
      {!full && (
        <header className="sched-head">
          <span className="sched-team">
            {teamName}
            {shownRecord && <span className="sched-record">{shownRecord}</span>}
          </span>
          {schedule?.season && <span className="sched-season">{schedule.season}</span>}
        </header>
      )}
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
            <ScheduleRow key={game.id ?? i} game={game} current={i === focused} leagueKey={leagueKey} navigate={navigate} />
          ))}
        </ol>
      )}
    </section>
  )
}

export default memo(TeamSchedule)
