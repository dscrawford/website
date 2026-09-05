import TeamSchedule from './TeamSchedule.jsx'
import useTeamSchedule from '../../hooks/useTeamSchedule.js'
import './SchedulePanel.css'

// Both teams' season schedules for the game page: side by side on wide
// screens, stacked on phones (see SchedulePanel.css)
export default function SchedulePanel({ leagueKey, game }) {
  const awayId = game?.awayTeam?.id ?? null
  const homeId = game?.homeTeam?.id ?? null
  const away = useTeamSchedule(leagueKey, awayId)
  const home = useTeamSchedule(leagueKey, homeId)

  if (!awayId && !homeId) return null

  return (
    <div className="sched-panel">
      {awayId && (
        <TeamSchedule
          schedule={away.schedule}
          loading={away.loading}
          error={away.error}
          onRetry={away.retry}
          currentGameId={game.id}
          record={game.awayTeam.record ?? null}
        />
      )}
      {homeId && (
        <TeamSchedule
          schedule={home.schedule}
          loading={home.loading}
          error={home.error}
          onRetry={home.retry}
          currentGameId={game.id}
          record={game.homeTeam.record ?? null}
        />
      )}
    </div>
  )
}
