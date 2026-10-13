// ESPN's poll rank for a college team going into a game; 99 and up mean
// unranked
const MAX_RANK = 25

export function pollRank(competitor) {
  const rank = Number.parseInt(competitor?.curatedRank?.current, 10)
  return Number.isFinite(rank) && rank >= 1 && rank <= MAX_RANK ? rank : null
}
