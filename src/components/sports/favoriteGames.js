// Which of the day's games involve a favorite, in league order, no repeats
export function favoriteGames(favorites, leagues) {
  if (!leagues) return []
  const wanted = new Set(favorites.map((f) => `${f.league}:${f.id}`))
  const out = []
  for (const [leagueKey, data] of Object.entries(leagues)) {
    for (const game of data?.games ?? []) {
      const hit = [game.awayTeam?.id, game.homeTeam?.id].some((id) => id && wanted.has(`${leagueKey}:${id}`))
      if (hit) out.push({ leagueKey, game })
    }
  }
  return out
}
