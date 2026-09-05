const DOT = ' \u00B7 '

// ESPN's own convention: "AWAY @ HOME", or "AWAY vs HOME" at a neutral site
export function formatMatchup(game) {
  const away = game?.awayTeam?.abbreviation
  const home = game?.homeTeam?.abbreviation
  if (!away || !home) return ''
  return `${away} ${game.neutralSite ? 'vs' : '@'} ${home}`
}

// "Cotton Bowl · Dallas, TX"; parts that ESPN did not send are left out
export function formatVenue(venue) {
  if (!venue?.name) return ''
  const place = [venue.city, venue.state].filter(Boolean).join(', ')
  return place ? `${venue.name}${DOT}${place}` : venue.name
}
