import { useState, useCallback, useRef } from 'react'
import useRoute from './hooks/useRoute.js'
import TopNav from './components/TopNav.jsx'
import CenterCard from './components/CenterCard.jsx'
import TetrisBackground from './components/TetrisBackground.jsx'
import TetrisSidebar from './components/TetrisSidebar.jsx'
import SportsPage from './components/sports/SportsPage.jsx'
import './App.css'

function HomePage({ navigate }) {
  const [cardFocused, setCardFocused] = useState(true)
  const [gameState, setGameState] = useState(null)
  const [aiInfo, setAiInfo] = useState(null)
  const [aiStrategy, setAiStrategy] = useState(() =>
    Math.random() < 0.5 ? 'flat' : 'fourWide'
  )
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [cardState, setCardState] = useState('visible')
  const [uiHidden, setUiHidden] = useState(false)
  const resetRef = useRef(null)
  const orbRef = useRef(null)
  const uiToggleRef = useRef(null)

  const aiEnabled = aiStrategy !== 'off'
  const strategyCode = aiStrategy === 'fourWide' ? 1 : 0

  const handleStateChange = useCallback((state) => {
    setGameState(state)
    window.__tetrisState = state
  }, [])

  const handleReset = useCallback(() => {
    resetRef.current?.()
  }, [])

  const handleBackgroundClick = () => {
    setCardFocused(false)
  }

  const getToggleCenter = useCallback(() => {
    const el = uiToggleRef.current
    if (!el) return { x: window.innerWidth - 28, y: 28 }
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, [])

  const animateArc = useCallback((from, to) => {
    const orb = orbRef.current
    if (!orb) return Promise.resolve()

    const midX = (from.x + to.x) / 2
    const midY = Math.min(from.y, to.y) - 120

    orb.style.offsetPath =
      `path('M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}')`
    orb.style.display = 'block'

    const anim = orb.animate(
      [{ offsetDistance: '0%' }, { offsetDistance: '100%' }],
      { duration: 500, easing: 'ease-in-out', fill: 'forwards' }
    )

    return anim.finished.then(() => {
      orb.style.display = 'none'
    })
  }, [])

  const handleCardHide = useCallback(() => {
    if (cardState !== 'visible') return
    setCardState('collapsing')

    setTimeout(() => {
      setCardState('arc-out')
      const from = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const to = getToggleCenter()
      animateArc(from, to).then(() => setCardState('hidden'))
    }, 300)
  }, [cardState, animateArc, getToggleCenter])

  const handleCardShow = useCallback(() => {
    if (cardState !== 'hidden') return
    setCardState('arc-in')

    const from = getToggleCenter()
    const to = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    animateArc(from, to).then(() => {
      setCardState('expanding')
      setTimeout(() => setCardState('visible'), 300)
    })
  }, [cardState, animateArc, getToggleCenter])

  const handleToggleClick = useCallback((e) => {
    e.stopPropagation()
    if (uiHidden) {
      setUiHidden(false)
      setCardState('visible')
    } else if (cardState === 'hidden') {
      handleCardShow()
    } else if (cardState === 'visible') {
      setUiHidden(true)
    }
  }, [uiHidden, cardState, handleCardShow])

  const showCard = cardState === 'visible' || cardState === 'collapsing' || cardState === 'expanding'
  const cardAnimClass =
    cardState === 'collapsing' ? 'collapsing' :
    cardState === 'expanding' ? 'expanding' : ''

  return (
    <div className="site" onClick={handleBackgroundClick}>
      <TetrisBackground
        active={!cardFocused}
        onStateChange={handleStateChange}
        onAiInfoChange={setAiInfo}
        onResetRef={resetRef}
        aiEnabled={aiEnabled}
        aiStrategy={strategyCode}
        speedMultiplier={speedMultiplier}
        targetFillRatio={0.75}
      />
      {!uiHidden && (
        <>
          <TopNav navigate={navigate} activePage="home" />
          {sidebarVisible && (
            <TetrisSidebar
              nextQueue={gameState?.nextQueue}
              hold={gameState?.hold}
              score={gameState?.score}
              level={gameState?.level}
              aiStrategy={aiStrategy}
              onAiStrategyChange={setAiStrategy}
              speedMultiplier={speedMultiplier}
              onSpeedChange={setSpeedMultiplier}
              aiInfo={aiInfo}
              onReset={handleReset}
            />
          )}
          {showCard && (
            <CenterCard
              onFocusChange={setCardFocused}
              onHide={handleCardHide}
              className={cardAnimClass}
            />
          )}
          <button
            className="sidebar-toggle-btn"
            onClick={(e) => { e.stopPropagation(); setSidebarVisible((v) => !v) }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title={sidebarVisible ? 'Hide scoreboard' : 'Show scoreboard'}
          >
            {sidebarVisible ? '\u00BB' : '\u00AB'}
          </button>
        </>
      )}
      <div ref={orbRef} className="arc-orb" />
      <button
        ref={uiToggleRef}
        className="ui-toggle-btn"
        onClick={handleToggleClick}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        title={uiHidden ? 'Show UI' : cardState === 'hidden' ? 'Show card' : 'Hide UI'}
      >
        {uiHidden ? '\u25CE' : '\u25C9'}
      </button>
    </div>
  )
}

function App() {
  const { pathname, navigate } = useRoute()

  if (pathname === '/sports') {
    return <SportsPage navigate={navigate} />
  }

  return <HomePage navigate={navigate} />
}

export default App
