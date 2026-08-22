export function formatDateTime(dateStr, fallback) {
  if (!dateStr) return fallback || 'TBD'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return fallback || 'TBD'
    const month = d.toLocaleDateString([], { month: 'short' })
    const day = d.getDate()
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${month} ${day}, ${time}`
  } catch {
    return fallback || 'TBD'
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return ''
    const month = d.toLocaleDateString([], { month: 'short' })
    const day = d.getDate()
    return `${month} ${day}`
  } catch {
    return ''
  }
}
