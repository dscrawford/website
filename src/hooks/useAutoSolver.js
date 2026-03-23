import { useEffect, useRef, useCallback } from 'react'
import {
  initSolver,
  solveMoves,
  moveLeft,
  moveRight,
  rotateClockwise,
  rotateCounterClockwise,
  hardDrop,
  softDrop,
  holdPiece,
  createGame,
} from '../game-engine/engine-interface.js'
import { BOARD_HEIGHT } from '../game-engine/types.js'

// Move opcodes from Rust solver
const OPCODE_LEFT = 0
const OPCODE_RIGHT = 1
const OPCODE_CW = 2
const OPCODE_CCW = 3
const OPCODE_HARD_DROP = 4
const OPCODE_HOLD = 5
const OPCODE_SOFT_DROP = 6

// Per-opcode intervals (ms)
const MOVE_INTERVALS = {
  [OPCODE_LEFT]: 15,
  [OPCODE_RIGHT]: 15,
  [OPCODE_CW]: 50,
  [OPCODE_CCW]: 50,
  [OPCODE_HARD_DROP]: 40,
  [OPCODE_HOLD]: 30,
  [OPCODE_SOFT_DROP]: 8,
}

const OPCODE_ACTIONS = {
  [OPCODE_LEFT]: moveLeft,
  [OPCODE_RIGHT]: moveRight,
  [OPCODE_CW]: rotateClockwise,
  [OPCODE_CCW]: rotateCounterClockwise,
  [OPCODE_HARD_DROP]: hardDrop,
  [OPCODE_HOLD]: holdPiece,
  [OPCODE_SOFT_DROP]: softDrop,
}

export function useAutoSolver(stateRef, updateState, enabled, speedMultiplier = 1, targetFillRatio = 0.75, strategy = 0) {
  const moveQueueRef = useRef([])
  const readyRef = useRef(false)
  const moveTimerRef = useRef(0)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const speedRef = useRef(speedMultiplier)
  speedRef.current = speedMultiplier
  const targetFillRef = useRef(targetFillRatio)
  targetFillRef.current = targetFillRatio
  const strategyRef = useRef(strategy)
  strategyRef.current = strategy

  // Have we solved for the current piece? Reset when a new piece spawns.
  const hasSolvedRef = useRef(false)
  // Snapshot taken when moves finish executing (piece at landing position).
  // When this changes, a new piece has spawned.
  const waitingSnapRef = useRef(null)

  // Initialize WASM solver on mount
  useEffect(() => {
    initSolver().then((mod) => {
      readyRef.current = mod !== null
      if (mod) console.log('WASM Tetris solver loaded')
    })
  }, [])

  // Reset when enabled/strategy changes
  useEffect(() => {
    moveQueueRef.current = []
    hasSolvedRef.current = false
    waitingSnapRef.current = null
    moveTimerRef.current = 0
  }, [enabled, strategy])

  const executeMoves = useCallback((deltaMs) => {
    if (!enabledRef.current || !readyRef.current) return

    const state = stateRef.current
    if (!state) return

    // Auto-restart on game over
    if (state.gameOver) {
      updateState(createGame(state.width, BOARD_HEIGHT))
      moveQueueRef.current = []
      hasSolvedRef.current = false
      waitingSnapRef.current = null
      return
    }

    // --- Phase 1: Detect new piece spawn ---
    // When we're waiting for lock (moves done, waiting for gravity to lock piece),
    // detect the new piece by comparing the current piece state to our snapshot.
    if (waitingSnapRef.current !== null) {
      const c = state.current
      const now = `${c.type}:${c.row}:${c.col}`
      if (now !== waitingSnapRef.current) {
        // Piece changed — new spawn detected
        waitingSnapRef.current = null
        hasSolvedRef.current = false
      } else {
        // Still waiting for lock delay + spawn
        return
      }
    }

    // --- Phase 2: Solve once per piece ---
    if (!hasSolvedRef.current) {
      hasSolvedRef.current = true
      const moves = solveMoves(state, targetFillRef.current, strategyRef.current)
      if (moves && moves.length > 0) {
        moveQueueRef.current = moves
        moveTimerRef.current = 0
      }
    }

    // --- Phase 3: Execute queued moves ---
    if (moveQueueRef.current.length > 0) {
      const speed = speedRef.current
      if (speed >= 10) {
        let s = stateRef.current
        while (moveQueueRef.current.length > 0) {
          const opcode = moveQueueRef.current.shift()
          const action = OPCODE_ACTIONS[opcode]
          if (action && s) s = action(s)
        }
        if (s !== stateRef.current) updateState(s)
      } else {
        moveTimerRef.current += deltaMs
        while (moveQueueRef.current.length > 0) {
          const nextOpcode = moveQueueRef.current[0]
          const interval = (MOVE_INTERVALS[nextOpcode] ?? 60) / speed
          if (moveTimerRef.current < interval) break
          moveTimerRef.current -= interval
          const opcode = moveQueueRef.current.shift()
          const action = OPCODE_ACTIONS[opcode]
          if (action && stateRef.current) {
            updateState(action(stateRef.current))
          }
        }
      }
    }

    // --- Phase 4: All moves done — enter waiting state ---
    // Snapshot the piece at its landing position. Gravity ticks will handle
    // lock delay. Once the piece locks and a new one spawns, the snapshot
    // won't match and we'll solve again (Phase 1).
    if (moveQueueRef.current.length === 0 && waitingSnapRef.current === null && hasSolvedRef.current) {
      const c = stateRef.current.current
      waitingSnapRef.current = `${c.type}:${c.row}:${c.col}`
    }
  }, [stateRef, updateState])

  return executeMoves
}
