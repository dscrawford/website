function transformCompetitor(competitor) {
  const team = competitor.team || {}
  return Object.freeze({
    name: team.displayName || team.name || 'Unknown',
    abbreviation: team.abbreviation || '???',
    logo: team.logo || null,
    score: parseInt(competitor.score || '0', 10),
    record: competitor.records?.[0]?.summary || null,
    homeAway: competitor.homeAway || null,
  })
}

function extractBroadcasts(competition) {
  if (!competition.broadcasts) return []

  return competition.broadcasts.flatMap((b) =>
    (b.names || []).map((name) => name)
  )
}

export function transformEvent(event) {
  const competition = event.competitions?.[0]
  if (!competition) return null

  const competitors = competition.competitors || []
  const home = competitors.find((c) => c.homeAway === 'home')
  const away = competitors.find((c) => c.homeAway === 'away')

  if (!home || !away) return null

  const status = event.status || {}
  const statusType = status.type || {}

  return Object.freeze({
    id: event.id,
    homeTeam: transformCompetitor(home),
    awayTeam: transformCompetitor(away),
    status: Object.freeze({
      state: statusType.state || 'pre',
      period: status.period || 0,
      clock: status.displayClock || '0:00',
      detail: statusType.shortDetail || statusType.detail || '',
      completed: statusType.completed || false,
    }),
    broadcasts: Object.freeze(extractBroadcasts(competition)),
    startTime: event.date || null,
  })
}

export function transformScoreboard(rawData) {
  if (!rawData?.events) return Object.freeze([])

  return Object.freeze(
    rawData.events
      .map(transformEvent)
      .filter(Boolean)
  )
}
