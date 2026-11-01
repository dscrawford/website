import './TopNav.css'

// GamesOnTheGo's web UI, served by the GOTG service under /games (the cluster's
// ingress routes it there; this site's nginx never sees it). A full page load,
// not an in-app route. Absolute in production: sign-in's cookie and OAuth
// callback belong to dcraw.net, and www.dcraw.net / danielscrawford.com serve
// these pages too. In dev, vite proxies /games to a local `gotg-service`.
const GAMES_URL = import.meta.env.DEV ? '/games/ui/' : 'https://dcraw.net/games/ui/'

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
          {' | '}
          <a href={GAMES_URL} className="nav-link">GAMES</a>
        </span>
      </div>
    </nav>
  )
}
