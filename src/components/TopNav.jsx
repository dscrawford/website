import './TopNav.css'

export default function TopNav() {
  return (
    <nav className="top-nav">
      <div className="nav-left">
        <span className="site-title">DCRAW.NET</span>
        <span className="nav-links">
          <span className="nav-link-disabled">GAMES</span>
          {' | '}
          <a href="https://github.com/dscrawford" className="nav-link" target="_blank" rel="noopener noreferrer">CODE</a>
          {' | '}
          <a href="/data/resume.pdf" className="nav-link" target="_blank" rel="noopener noreferrer">RESUME</a>
        </span>
      </div>
    </nav>
  )
}
