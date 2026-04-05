import './SportsNav.css'

const TABS = [
  { key: 'nfl', label: 'NFL' },
  { key: 'ncaaf', label: 'NCAAF' },
  { key: 'nba', label: 'NBA' },
  { key: 'cbb', label: 'CBB' },
  { key: 'mlb', label: 'MLB' },
]

export default function SportsNav() {
  const scrollTo = (key) => {
    const el = document.getElementById(key)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="sports-nav">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className="sports-nav-tab"
          onClick={() => scrollTo(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
