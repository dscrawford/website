import './CenterCard.css'

export default function CenterCard({ onFocusChange }) {
  return (
    <div
      className="center-card"
      onMouseDown={() => onFocusChange?.(true)}
      onFocus={() => onFocusChange?.(true)}
      tabIndex={-1}
    >
      <h1>DANIEL<br />CRAWFORD</h1>
      <a href="/data/resume.pdf" className="resume-btn" target="_blank" rel="noopener noreferrer">
        <span className="resume-icon">📄</span>
        RESUME (PDF)
      </a>
    </div>
  )
}
