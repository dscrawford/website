import { useState, useCallback } from 'react'
import TopNav from './components/TopNav.jsx'
import CenterCard from './components/CenterCard.jsx'
import TetrisBackground from './components/TetrisBackground.jsx'
import TetrisSidebar from './components/TetrisSidebar.jsx'
import './App.css'

function App() {
  const [cardFocused, setCardFocused] = useState(true)
  const [gameState, setGameState] = useState(null)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [speedMultiplier, setSpeedMultiplier] = useState(2)
  const [uiHidden, setUiHidden] = useState(false)

  const handleStateChange = useCallback((state) => {
    setGameState(state)
    // Expose for E2E testing
    window.__tetrisState = state
  }, [])

  const handleBackgroundClick = () => {
    setCardFocused(false)
  }

  return (
    <div className="site" onClick={handleBackgroundClick}>
      <TetrisBackground
        active={!cardFocused}
        onStateChange={handleStateChange}
        aiEnabled={aiEnabled}
        speedMultiplier={speedMultiplier}
        targetFillRatio={0.75}
      />
      {!uiHidden && (
        <>
          <TopNav />
          <TetrisSidebar
            nextQueue={gameState?.nextQueue}
            hold={gameState?.hold}
            score={gameState?.score}
            level={gameState?.level}
            aiEnabled={aiEnabled}
            onAiToggle={setAiEnabled}
            speedMultiplier={speedMultiplier}
            onSpeedChange={setSpeedMultiplier}
          />
          <CenterCard onFocusChange={setCardFocused} />
        </>
      )}
      <button
        className="ui-toggle-btn"
        onClick={(e) => { e.stopPropagation(); setUiHidden((h) => !h) }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        title={uiHidden ? 'Show UI' : 'Hide UI'}
      >
        {uiHidden ? '◉' : '◎'}
      </button>
    </div>
  )
}

export default App
