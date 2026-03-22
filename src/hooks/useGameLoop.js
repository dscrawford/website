import { useEffect, useRef } from 'react'
import { getDropInterval } from '../game-engine/scoring.js'

export function useGameLoop(stateRef, onTick, onRender, paused, onFrame, speedMultiplier = 1) {
  const accumulatorRef = useRef(0)
  const lastTimeRef = useRef(null)
  const speedRef = useRef(speedMultiplier)
  speedRef.current = speedMultiplier

  useEffect(() => {
    if (paused) {
      lastTimeRef.current = null
      return
    }

    let rafId = null

    function loop(timestamp) {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp
      }

      const delta = timestamp - lastTimeRef.current
      lastTimeRef.current = timestamp
      accumulatorRef.current += delta

      // Snapshot piece identity before onFrame (solver may hard-drop + spawn new piece)
      const pieceBeforeFrame = stateRef.current?.current

      // Run per-frame callback (e.g. auto-solver move execution)
      if (onFrame) {
        onFrame(delta)
      }

      // If the piece changed (new spawn after hard drop), reset gravity accumulator
      // so the new piece starts at row 0 without immediate gravity ticks
      const pieceAfterFrame = stateRef.current?.current
      if (pieceBeforeFrame && pieceAfterFrame && pieceBeforeFrame !== pieceAfterFrame) {
        accumulatorRef.current = 0
      }

      const state = stateRef.current
      if (state && !state.gameOver) {
        const interval = getDropInterval(state.level) / speedRef.current
        const maxTicks = 4
        let tickCount = 0
        while (accumulatorRef.current >= interval && tickCount < maxTicks) {
          accumulatorRef.current -= interval
          onTick()
          tickCount++
        }
        // Discard excess time to prevent catch-up spiral at extreme speeds
        if (tickCount >= maxTicks) {
          accumulatorRef.current = 0
        }
      }

      onRender()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [stateRef, onTick, onRender, paused, onFrame])
}
