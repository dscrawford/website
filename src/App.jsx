import { useState, useCallback } from 'react'
import TopNav from './components/TopNav.jsx'
import CenterCard from './components/CenterCard.jsx'
import TetrisBackground from './components/TetrisBackground.jsx'
import TetrisSidebar from './components/TetrisSidebar.jsx'
import './App.css'

function App() {
  const [cardFocused, setCardFocused] = useState(true)
  const [gameState, setGameState] = useState(null)

  const handleStateChange = useCallback((state) => {
    setGameState(state)
  }, [])

  const handleBackgroundClick = () => {
    setCardFocused(false)
  }

  return (
    <div className="site" onClick={handleBackgroundClick}>
      <TetrisBackground
        active={!cardFocused}
        onStateChange={handleStateChange}
      />
      <TopNav />
      <TetrisSidebar
        nextQueue={gameState?.nextQueue}
        hold={gameState?.hold}
        score={gameState?.score}
        level={gameState?.level}
      />
      <CenterCard onFocusChange={setCardFocused} />
    </div>
  )
}

export default App
