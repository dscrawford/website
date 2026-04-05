import './StatusBadge.css'

export default function StatusBadge({ status }) {
  if (!status) return null

  const { state, detail } = status

  if (state === 'pre') {
    const time = status.detail || formatStartTime(detail)
    return <span className="status-badge status-pre">{time}</span>
  }

  if (state === 'in') {
    return (
      <span className="status-badge status-live">
        <span className="live-dot" />
        {detail}
      </span>
    )
  }

  return <span className="status-badge status-final">FINAL</span>
}

function formatStartTime(dateStr) {
  if (!dateStr) return 'TBD'
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
