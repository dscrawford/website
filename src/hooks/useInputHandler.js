import { useEffect, useRef, useCallback } from 'react'

const KEY_MAP = {
  ArrowLeft: 'moveLeft',
  a: 'moveLeft',
  A: 'moveLeft',
  ArrowRight: 'moveRight',
  d: 'moveRight',
  D: 'moveRight',
  ArrowDown: 'softDrop',
  s: 'softDrop',
  S: 'softDrop',
  ArrowUp: 'rotateClockwise',
  w: 'rotateClockwise',
  W: 'rotateClockwise',
  z: 'rotateCounterClockwise',
  Z: 'rotateCounterClockwise',
  ' ': 'hardDrop',
  c: 'holdPiece',
  C: 'holdPiece',
  Shift: 'holdPiece',
}

const DAS_INITIAL = 170
const DAS_REPEAT = 50
const REPEATABLE = new Set(['moveLeft', 'moveRight', 'softDrop'])

export function useInputHandler(active, actions) {
  const heldKeys = useRef(new Map()) // key → { action, timeoutId, intervalId }

  const handleAction = useCallback((action) => {
    if (!active || !actions[action]) return
    actions[action]()
  }, [active, actions])

  const startDAS = useCallback((key, action) => {
    if (!REPEATABLE.has(action)) return

    const timeoutId = setTimeout(() => {
      const intervalId = setInterval(() => handleAction(action), DAS_REPEAT)
      const entry = heldKeys.current.get(key)
      if (entry) entry.intervalId = intervalId
    }, DAS_INITIAL)

    return timeoutId
  }, [handleAction])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!active) return
      const action = KEY_MAP[e.key]
      if (!action) return

      e.preventDefault()

      // Ignore key repeat from OS
      if (heldKeys.current.has(e.key)) return

      handleAction(action)

      const timeoutId = startDAS(e.key, action)
      heldKeys.current.set(e.key, { action, timeoutId, intervalId: null })
    }

    const onKeyUp = (e) => {
      const entry = heldKeys.current.get(e.key)
      if (entry) {
        if (entry.timeoutId) clearTimeout(entry.timeoutId)
        if (entry.intervalId) clearInterval(entry.intervalId)
        heldKeys.current.delete(e.key)
      }
    }

    const clearAll = () => {
      for (const [, entry] of heldKeys.current) {
        if (entry.timeoutId) clearTimeout(entry.timeoutId)
        if (entry.intervalId) clearInterval(entry.intervalId)
      }
      heldKeys.current.clear()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearAll)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearAll)
      clearAll()
    }
  }, [active, handleAction, startDAS])
}
