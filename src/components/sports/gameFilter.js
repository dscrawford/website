// Matches a query against both team abbreviations and full names so either
// direction works: "OU" finds Oklahoma, "Oklahoma" finds the card showing OU.
// Tokens match word-prefixes, not raw substrings — "ou" must not surface
// every team with "ou" buried in its name (e.g. Louisville).
export function filterGames(games, query) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : ''
  if (!q) return games
  const tokens = q.split(/\s+/)

  return games.filter((game) => {
    const words = []
    const abbrs = []
    for (const team of [game.awayTeam, game.homeTeam]) {
      if (!team) continue
      if (team.name) {
        words.push(...String(team.name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
      }
      if (team.abbreviation) {
        abbrs.push(String(team.abbreviation).toLowerCase())
      }
    }
    return tokens.every(
      (t) => abbrs.some((a) => a.startsWith(t)) || words.some((w) => w.startsWith(t))
    )
  })
}
