import GameCard from './GameCard.jsx'
import FavoriteButton from './FavoriteButton.jsx'
import { teamPath } from './leagues.js'
import { favoriteGames } from './favoriteGames.js'
import './FavoritesSection.css'

export default function FavoritesSection({ favorites, leagues, navigate }) {
  if (!favorites || favorites.length === 0) return null
  const games = favoriteGames(favorites, leagues)

  return (
    <section className="fav-section" aria-label="Favorites">
      <h2 className="league-title">FAVORITES</h2>
      <ul className="fav-chips">
        {favorites.map((team) => (
          <li key={`${team.league}:${team.id}`} className="fav-chip">
            <a
              className="fav-chip-link"
              href={teamPath(team.league, team.id)}
              title={team.name}
              onClick={(e) => {
                e.preventDefault()
                navigate?.(teamPath(team.league, team.id))
              }}
            >
              {team.abbreviation}
              <span className="fav-chip-league">{team.league.toUpperCase()}</span>
            </a>
            <FavoriteButton team={team} />
          </li>
        ))}
      </ul>
      {games.length > 0 && (
        <div className="league-grid">
          {games.map(({ leagueKey, game }) => (
            <GameCard key={`${leagueKey}:${game.id}`} game={game} navigate={navigate} leagueKey={leagueKey} />
          ))}
        </div>
      )}
      {leagues && games.length === 0 && <p className="league-empty">No games for your teams today</p>}
    </section>
  )
}
