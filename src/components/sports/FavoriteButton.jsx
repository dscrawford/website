import useFavorites from '../../hooks/useFavorites.js'
import './FavoriteButton.css'

// Star toggle for one team; `team` is { league, id, abbreviation, name }
export default function FavoriteButton({ team, className = '' }) {
  const { isFavorite, toggle } = useFavorites()
  if (!team?.id || !team.league) return null
  const on = isFavorite(team.league, team.id)
  const label = on ? `Remove ${team.name} from favorites` : `Add ${team.name} to favorites`
  return (
    <button
      type="button"
      className={`fav-btn${on ? ' fav-btn--on' : ''} ${className}`.trim()}
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(team)
      }}
    >
      {on ? '★' : '☆'}
    </button>
  )
}
