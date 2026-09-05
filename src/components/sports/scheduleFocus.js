// The row to focus: this game, else the next game still to be played
// (hash-form ids never appear in ESPN schedules), else the last row
export function focusIndex(games, currentGameId) {
  const current = games.findIndex((g) => g.id === currentGameId)
  if (current >= 0) return current
  const next = games.findIndex((g) => g.state === 'in' || g.state === 'pre')
  return next >= 0 ? next : games.length - 1
}
