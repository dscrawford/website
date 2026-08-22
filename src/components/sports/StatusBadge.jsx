import './StatusBadge.css'

export default function StatusBadge({ status, startTime }) {
  if (!status) return null

  const { state, detail } = status

  if (state === 'pre') {
    return (
      <span className="status-badge status-pre">
        {formatDateTime(startTime, detail)}
      </span>
    )
  }

  if (state === 'in') {
    return (
      <span className="status-badge status-live">
        <span className="live-dot" />
        {detail}
      </span>
    )
  }

  // post / final
  return (
    <span className="status-badge status-final">
      {detail || 'FINAL'}
      {startTime && <span className="status-date"> · {formatDate(startTime)}</span>}
    </span>
  )
}

function formatDateTime(dateStr, fallback) {
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

function formatDate(dateStr) {
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
