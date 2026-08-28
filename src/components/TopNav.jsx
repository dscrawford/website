import './TopNav.css'

export default function TopNav({ navigate }) {
  const handleNavClick = (e, path) => {
    e.preventDefault()
    navigate?.(path)
  }

  return (
    <nav className="top-nav">
      <div className="nav-left">
        <a
          href="/"
          className="site-title"
          onClick={(e) => handleNavClick(e, '/')}
        >
          DCRAW.NET
        </a>
        <span className="nav-links">
          <a href="https://github.com/dscrawford" className="nav-link" target="_blank" rel="noopener noreferrer">CODE</a>
          {' | '}
          <a href="/data/resume.pdf" className="nav-link" target="_blank" rel="noopener noreferrer">RESUME</a>
        </span>
      </div>
    </nav>
  )
}
