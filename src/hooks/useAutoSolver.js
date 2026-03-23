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
  const waitingSnapRef = useRef(null)

  useEffect(() => {
    initSolver().then((mod) => {
      readyRef.current = mod !== null
      if (mod) console.log('WASM Tetris solver loaded')
    })
  }, [])

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

    if (state.gameOver) {
      updateState(createGame(state.width, BOARD_HEIGHT))
      moveQueueRef.current = []
      hasSolvedRef.current = false
      waitingSnapRef.current = null
      return
    }

    const speed = speedRef.current

    // --- HIGH SPEED PATH (>= 10x): solve + execute + hard drop in one frame ---
    if (speed >= 10) {
      let s = stateRef.current
      let iterations = 0
      const maxIterations = 3

      while (iterations < maxIterations && s && !s.gameOver) {
        if (moveQueueRef.current.length === 0) {
          const moves = solveMoves(s, targetFillRef.current, strategyRef.current)
          if (!moves || moves.length === 0) break
          moveQueueRef.current = moves
        }

        // Execute entire move queue (rotations, horizontals, soft drops)
        while (moveQueueRef.current.length > 0) {
          const opcode = moveQueueRef.current.shift()
          const action = OPCODE_ACTIONS[opcode]
          if (action && s) s = action(s)
        }

        // Hard drop to instantly lock and spawn next piece
        if (s && !s.gameOver) {
          s = hardDrop(s)
        }

        iterations++
      }

      if (s && s !== stateRef.current) {
        updateState(s)
      }
      return
    }

    // --- NORMAL SPEED PATH (< 10x): solve once, execute over time ---

    // Phase 1: Detect new piece spawn
    if (waitingSnapRef.current !== null) {
      const c = state.current
      const now = `${c.type}:${c.row}:${c.col}`
      if (now !== waitingSnapRef.current) {
        waitingSnapRef.current = null
        hasSolvedRef.current = false
      } else {
        return // still waiting for lock + spawn
      }
    }

    // Phase 2: Solve once per piece
    if (!hasSolvedRef.current) {
      hasSolvedRef.current = true
      const moves = solveMoves(state, targetFillRef.current, strategyRef.current)
      if (moves && moves.length > 0) {
        moveQueueRef.current = moves
        moveTimerRef.current = 0
      }
    }

    // Phase 3: Execute queued moves at timed intervals
    if (moveQueueRef.current.length > 0) {
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

    // Phase 4: All soft drops done — hard drop to lock instantly and move on.
    // The piece has been soft-dropped to its target position; slam it down.
    if (moveQueueRef.current.length === 0 && hasSolvedRef.current && waitingSnapRef.current === null) {
      const locked = hardDrop(stateRef.current)
      updateState(locked)
      // New piece spawned — ready to solve next frame
      hasSolvedRef.current = false
    }
  }, [stateRef, updateState])

  return executeMoves
}
