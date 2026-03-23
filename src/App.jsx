import { useState, useCallback, useRef } from 'react'
import TopNav from './components/TopNav.jsx'
import CenterCard from './components/CenterCard.jsx'
import TetrisBackground from './components/TetrisBackground.jsx'
import TetrisSidebar from './components/TetrisSidebar.jsx'
import './App.css'

function App() {
  const [cardFocused, setCardFocused] = useState(true)
  const [gameState, setGameState] = useState(null)
  const [aiInfo, setAiInfo] = useState(null)
  const [aiStrategy, setAiStrategy] = useState(() =>
    Math.random() < 0.5 ? 'flat' : 'fourWide'
  )
  const [speedMultiplier, setSpeedMultiplier] = useState(1)
  const [uiHidden, setUiHidden] = useState(false)
  const resetRef = useRef(null)

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
          <TopNav />
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
        {uiHidden ? '\u25C9' : '\u25CE'}
      </button>
    </div>
  )
}

export default App
