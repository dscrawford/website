import GameCard from './GameCard.jsx'
import './LeagueSection.css'

export default function LeagueSection({ id, label, games }) {
  return (
    <section className="league-section" id={id}>
      <h2 className="league-title">{label}</h2>
      {(!games || games.length === 0) ? (
        <p className="league-empty">No games today</p>
      ) : (
        <div className="league-grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </section>
  )
}
