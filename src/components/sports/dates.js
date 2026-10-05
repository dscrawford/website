// Local calendar day as YYYY-MM-DD (the visitor's "today")
export function todayISO(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Day arithmetic in UTC so DST never shifts the result by an hour
export function shiftDate(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatDay(iso) {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
