import { useEffect, useRef, useState } from 'react'
import { GAMES } from './games.js'
import './TopNav.css'

function GamesMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span className="nav-games" ref={ref}>
      <button
        type="button"
        className={`nav-link nav-menu-button${open ? ' nav-link-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        GAMES
      </button>
      {open && (
        <ul className="nav-menu" role="menu">
          {GAMES.map((game) => (
            <li key={game.href} role="none">
              <a href={game.href} className="nav-menu-item" role="menuitem">{game.name}</a>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

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
          <GamesMenu />
          {' | '}
          <a href="/sports" className="nav-link" onClick={(e) => handleNavClick(e, '/sports')}>SPORTS</a>
          {' | '}
          <a href="https://github.com/dscrawford" className="nav-link" target="_blank" rel="noopener noreferrer">CODE</a>
          {' | '}
          <a href="/data/resume.pdf" className="nav-link" target="_blank" rel="noopener noreferrer">RESUME</a>
        </span>
      </div>
    </nav>
  )
}
