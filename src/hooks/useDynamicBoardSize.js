import { useState, useEffect, useCallback } from 'react'
import { MAX_BOARD_WIDTH, MIN_BOARD_WIDTH } from '../game-engine/types.js'

export function calculateBoardDimensions(viewportWidth, viewportHeight, boardHeight) {
  const cellSize = Math.max(1, Math.floor(viewportHeight / boardHeight))
  const rawWidth = Math.floor(viewportWidth / cellSize)
  const width = Math.max(MIN_BOARD_WIDTH, Math.min(rawWidth, MAX_BOARD_WIDTH))
  return { cellSize, width, height: boardHeight }
}

export function useDynamicBoardSize(boardHeight = 40) {
  const [dimensions, setDimensions] = useState(() =>
    calculateBoardDimensions(window.innerWidth, window.innerHeight, boardHeight)
  )

  const handleResize = useCallback(() => {
    setDimensions(calculateBoardDimensions(window.innerWidth, window.innerHeight, boardHeight))
  }, [boardHeight])

  useEffect(() => {
    let timeoutId = null
    const debouncedResize = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(handleResize, 150)
    }
    window.addEventListener('resize', debouncedResize)
    return () => {
      window.removeEventListener('resize', debouncedResize)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [handleResize])

  return dimensions
}
