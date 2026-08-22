import TopNav from '../TopNav.jsx'
import SportsNav from './SportsNav.jsx'
import LeagueSection from './LeagueSection.jsx'
import useSportsData from '../../hooks/useSportsData.js'
import './SportsPage.css'

const LEAGUE_ORDER = [
  { key: 'nfl', label: 'NFL' },
  { key: 'ncaaf', label: 'NCAAF' },
  { key: 'nba', label: 'NBA' },
  { key: 'cbb', label: 'College Basketball' },
  { key: 'mlb', label: 'MLB' },
]

function formatTimeAgo(date) {
  if (!date) return ''
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  return `${minutes}m ago`
}

export default function SportsPage({ navigate }) {
  const { leagues, loading, error, lastUpdated } = useSportsData()

  return (
    <div className="sports-page">
      <TopNav navigate={navigate} activePage="sports" />
      <div className="sports-content">
        <h1 className="sports-title">LIVE SPORTS SCOREBOARD</h1>
        <SportsNav />

        {loading && !leagues && (
          <p className="sports-status">Loading scores...</p>
        )}

        {error && (
          <p className="sports-error">
            Unable to load scores. Retrying...
          </p>
        )}

        {leagues && LEAGUE_ORDER.map(({ key, label }) => {
          const data = leagues[key]
          return (
            <LeagueSection
              key={key}
              id={key}
              label={data?.label || label}
              games={data?.games || []}
            />
          )
        })}

        {lastUpdated && (
          <p className="sports-updated">
            Last Updated: {formatTimeAgo(lastUpdated)}
          </p>
        )}
      </div>
    </div>
  )
}
