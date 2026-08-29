import { useEffect, useRef, useState } from 'react'
import TopNav from '../TopNav.jsx'
import SportsNav from './SportsNav.jsx'
import LeagueSection from './LeagueSection.jsx'
import useSportsData from '../../hooks/useSportsData.js'
import { filterGames } from './gameFilter.js'
import './SportsPage.css'

const LEAGUE_ORDER = [
  { key: 'nfl', label: 'NFL' },
  { key: 'ncaaf', label: 'NCAAF' },
  { key: 'nba', label: 'NBA' },
  { key: 'cbb', label: 'College Basketball' },
  { key: 'mlb', label: 'MLB' },
]

const EMPTY_GAMES = []

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
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const searching = query.trim() !== ''
  const sections = leagues
    ? LEAGUE_ORDER.map(({ key, label }) => {
        const data = leagues[key]
        return {
          key,
          label: data?.label || label,
          games: filterGames(data?.games || EMPTY_GAMES, query),
        }
      })
    : null
  const anyMatches = sections?.some((s) => s.games.length > 0)

  return (
    <div className="sports-page">
      <TopNav navigate={navigate} />
      <div className="sports-content">
        <h1 className="sports-title">LIVE SPORTS SCOREBOARD</h1>
        <SportsNav />

        <input
          ref={searchRef}
          className="sports-search"
          type="search"
          placeholder='Search teams — "OU" or "Oklahoma" (Ctrl+F)'
          aria-label="Search games"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {loading && !leagues && (
          <p className="sports-status">Loading scores...</p>
        )}

        {error && (
          <p className="sports-error">
            Unable to load scores. Retrying...
          </p>
        )}

        {sections?.map(({ key, label, games }) => {
          if (searching && games.length === 0) return null
          return (
            <LeagueSection
              key={key}
              id={key}
              label={label}
              games={games}
              navigate={navigate}
            />
          )
        })}

        {searching && sections && !anyMatches && (
          <p className="sports-status">No games match &quot;{query.trim()}&quot;.</p>
        )}

        {lastUpdated && (
          <p className="sports-updated">
            Last Updated: {formatTimeAgo(lastUpdated)}
          </p>
        )}
      </div>
    </div>
  )
}
