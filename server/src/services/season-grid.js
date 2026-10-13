// ESPN addresses a poll by season year, season type and week. A season
// grid lays those weeks out as date ranges so a calendar day can be
// turned into that address. Weeks are ordered; `type` 1 is preseason,
// 2 the regular season and 3 the postseason.

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
// Regular-season rankings appear weekly; postseason polls only after the
// final; off-season (type 4) weeks never carry a poll
const PRESEASON = 1
const REGULAR = 2
const POSTSEASON = 3
// Calendars add synthetic entries (CFP = 999) alongside the real weeks
const MAX_WEEK = 60

function ms(iso) {
  const t = Date.parse(iso ?? '')
  return Number.isFinite(t) ? t : null
}

function week(type, number, label, start, end) {
  return Object.freeze({ type, week: number, label, start, end })
}

function sortByStart(weeks) {
  return Object.freeze([...weeks].sort((a, b) => a.start - b.start))
}

// Football: the scoreboard calendar names every regular-season and bowl
// week with its dates. The preseason poll sits in the gap before week 1.
export function gridFromCalendar(scoreboard) {
  const league = scoreboard?.leagues?.[0]
  const year = Number.parseInt(league?.season?.year, 10)
  const calendar = Array.isArray(league?.calendar) ? league.calendar : []
  if (!Number.isFinite(year) || calendar.length === 0) return null

  const weeks = []
  for (const period of calendar) {
    const type = Number.parseInt(period?.value, 10)
    if (type !== REGULAR && type !== POSTSEASON) continue
    for (const entry of Array.isArray(period.entries) ? period.entries : []) {
      const number = Number.parseInt(entry?.value, 10)
      const start = ms(entry?.startDate)
      const end = ms(entry?.endDate)
      if (!Number.isFinite(number) || number > MAX_WEEK || start === null || end === null) continue
      weeks.push(week(type, number, String(entry.label ?? `Week ${number}`), start, end))
    }
  }
  if (weeks.length === 0) return null

  const seasonStart = ms(league.season.startDate)
  const regularStart = Math.min(...weeks.map((w) => w.start))
  if (seasonStart !== null && seasonStart < regularStart) {
    weeks.push(week(PRESEASON, 1, 'Preseason', seasonStart, regularStart - 1))
  }
  return Object.freeze({ year, label: String(league.season.displayName ?? year), weeks: sortByStart(weeks) })
}

// Basketball: polls fall on uniform seven-day weeks from the first day of
// the regular season; the postseason keeps that cadence but restarts its
// numbering at week 1, so the season's type boundaries lay them all out
export function gridFromSeasonTypes(season) {
  const year = Number.parseInt(season?.year, 10)
  const types = Array.isArray(season?.types?.items) ? season.types.items : []
  const regular = types.find((t) => Number.parseInt(t?.type, 10) === REGULAR)
  const post = types.find((t) => Number.parseInt(t?.type, 10) === POSTSEASON)
  const start = ms(regular?.startDate)
  const regularEnd = ms(regular?.endDate)
  if (!Number.isFinite(year) || start === null || regularEnd === null) return null

  const regularWeeks = Math.floor((regularEnd - start) / WEEK_MS) + 1
  const postEnd = ms(post?.endDate)
  const totalWeeks = postEnd === null ? regularWeeks : Math.floor((postEnd - start) / WEEK_MS) + 1
  const weeks = []
  for (let i = 0; i < totalWeeks; i++) {
    const inPost = i >= regularWeeks
    const number = inPost ? i - regularWeeks + 1 : i + 1
    weeks.push(week(inPost ? POSTSEASON : REGULAR, number, `Week ${i + 1}`, start + i * WEEK_MS, start + (i + 1) * WEEK_MS - 1))
  }
  return Object.freeze({ year, label: String(season.displayName ?? year), weeks: sortByStart(weeks) })
}

// Index of the week a day falls in, else the last week already over by
// then (polls hold between weeks); -1 before the season has any
export function weekIndexAt(weeks, day) {
  const at = ms(`${day}T12:00:00Z`)
  if (at === null) return -1
  let index = -1
  weeks.forEach((w, i) => {
    if (w.start <= at) index = i
  })
  return index
}
