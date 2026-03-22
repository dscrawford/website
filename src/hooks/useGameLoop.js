import { useEffect, useRef } from 'react'
import { getDropInterval } from '../game-engine/scoring.js'

export function useGameLoop(stateRef, onTick, onRender, paused, onFrame) {
  const accumulatorRef = useRef(0)
  const lastTimeRef = useRef(null)

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

      // Run per-frame callback (e.g. auto-solver move execution)
      if (onFrame) {
        onFrame(delta)
      }

      const state = stateRef.current
      if (state && !state.gameOver) {
        const interval = getDropInterval(state.level)
        while (accumulatorRef.current >= interval) {
          accumulatorRef.current -= interval
          onTick()
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
