import { formatDateTime, formatDate } from './gameTime.js'
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

  return (
    <span className="status-badge status-final">
      {detail || 'FINAL'}
      {startTime && <span className="status-date"> · {formatDate(startTime)}</span>}
    </span>
  )
}
