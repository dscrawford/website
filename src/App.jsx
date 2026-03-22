import './App.css'

function App() {
  return (
    <div className="site">
      {/* Top nav */}
      <nav className="top-nav">
        <div className="nav-left">
          <span className="site-title">DANIELCRAWFORD.DEV</span>
          <span className="nav-links">GAMES | CODE | RESUME</span>
        </div>
      </nav>

      {/* Center card */}
      <div className="center-card">
        <h1>DANIEL<br />CRAWFORD</h1>
        <a href="/resume.pdf" className="resume-btn">
          <span className="resume-icon">📄</span>
          RESUME (PDF)
        </a>
      </div>

      {/* Tetris background will go here — placeholder for now */}
      <div className="tetris-bg-placeholder" />
    </div>
  )
}

export default App
