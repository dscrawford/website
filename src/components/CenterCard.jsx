import './CenterCard.css'

export default function CenterCard({ onFocusChange, onHide, className = '' }) {
  return (
    <div
      className={`center-card${className ? ` ${className}` : ''}`}
      onMouseDown={() => onFocusChange?.(true)}
      onFocus={() => onFocusChange?.(true)}
      tabIndex={-1}
    >
      <button
        className="card-hide-btn"
        onClick={(e) => { e.stopPropagation(); onHide?.() }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        title="Hide card"
      >
        {'\u25CE'}
      </button>
      <h1>DANIEL<br />CRAWFORD</h1>
      <a href="/data/resume.pdf" className="resume-btn" target="_blank" rel="noopener noreferrer">
        <span className="resume-icon">📄</span>
        RESUME (PDF)
      </a>
    </div>
  )
}
