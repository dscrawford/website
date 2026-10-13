import { memo } from 'react'
import GameCard from './GameCard.jsx'
import { hasPolls, rankingsPath, standingsPath } from './leagues.js'
import './LeagueSection.css'

function SectionLink({ href, navigate, children }) {
  return (
    <a
      className="league-link"
      href={href}
      onClick={(e) => {
        e.preventDefault()
        navigate?.(href)
      }}
    >
      {children}
    </a>
  )
}

// `date` is the board's day, so the rankings link opens that day's polls
function LeagueSection({ id, label, games, navigate, date }) {
  return (
    <section className="league-section" id={id}>
      <div className="league-head">
        <h2 className="league-title">{label}</h2>
        <nav className="league-links" aria-label={`${label} tables`}>
          {hasPolls(id) && (
            <SectionLink href={rankingsPath(id, date)} navigate={navigate}>
              RANKINGS
            </SectionLink>
          )}
          <SectionLink href={standingsPath(id)} navigate={navigate}>
            STANDINGS
          </SectionLink>
        </nav>
      </div>
      {(!games || games.length === 0) ? (
        <p className="league-empty">No games today</p>
      ) : (
        <div className="league-grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} navigate={navigate} leagueKey={id} />
          ))}
        </div>
      )}
    </section>
  )
}

export default memo(LeagueSection)
