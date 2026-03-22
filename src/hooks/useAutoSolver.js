import { useEffect, useRef, useCallback } from 'react'
import {
  initSolver,
  solveMoves,
  moveLeft,
  moveRight,
  rotateClockwise,
  rotateCounterClockwise,
  hardDrop,
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

// Per-opcode intervals: horizontal moves are fast, rotations/drops are visible
const MOVE_INTERVALS = {
  [OPCODE_LEFT]: 15,
  [OPCODE_RIGHT]: 15,
  [OPCODE_CW]: 50,
  [OPCODE_CCW]: 50,
  [OPCODE_HARD_DROP]: 40,
  [OPCODE_HOLD]: 30,
}

const OPCODE_ACTIONS = {
  [OPCODE_LEFT]: moveLeft,
  [OPCODE_RIGHT]: moveRight,
  [OPCODE_CW]: rotateClockwise,
  [OPCODE_CCW]: rotateCounterClockwise,
  [OPCODE_HARD_DROP]: hardDrop,
  [OPCODE_HOLD]: holdPiece,
}

export function useAutoSolver(stateRef, updateState, enabled, speedMultiplier = 1, targetFillRatio = 0.75) {
  const moveQueueRef = useRef([])
  const readyRef = useRef(false)
  const lastPieceRef = useRef(null)
  const moveTimerRef = useRef(0)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const speedRef = useRef(speedMultiplier)
  speedRef.current = speedMultiplier
  const targetFillRef = useRef(targetFillRatio)
  targetFillRef.current = targetFillRatio

  // Initialize WASM solver on mount (always, regardless of enabled)
  useEffect(() => {
    initSolver().then((mod) => {
      readyRef.current = mod !== null
      if (mod) {
        console.log('WASM Tetris solver loaded')
      }
    })
  }, [])

  // Reset move queue when enabled state changes
  useEffect(() => {
    if (!enabled) {
      moveQueueRef.current = []
      lastPieceRef.current = null
      moveTimerRef.current = 0
    }
  }, [enabled])

  // Execute queued moves at a steady rate (called from game loop)
  const executeMoves = useCallback((deltaMs) => {
    if (!enabledRef.current || !readyRef.current) return

    const state = stateRef.current
    if (!state) return

    // Auto-restart on game over
    if (state.gameOver) {
      updateState(createGame(state.width, BOARD_HEIGHT))
      moveQueueRef.current = []
      lastPieceRef.current = null
      return
    }

    // Compute moves when we need them
    if (moveQueueRef.current.length === 0) {
      const pieceKey = `${state.current.type}-${state.current.col}-${state.current.row}`
      if (pieceKey !== lastPieceRef.current) {
        lastPieceRef.current = pieceKey
        const moves = solveMoves(state, targetFillRef.current)
        if (moves && moves.length > 0) {
          moveQueueRef.current = moves
          moveTimerRef.current = 0
        }
      }
    }

    // Execute moves at per-opcode intervals
    if (moveQueueRef.current.length > 0) {
      moveTimerRef.current += deltaMs
      while (moveQueueRef.current.length > 0) {
        const nextOpcode = moveQueueRef.current[0]
        const interval = (MOVE_INTERVALS[nextOpcode] ?? 60) / speedRef.current
        if (moveTimerRef.current < interval) break
        moveTimerRef.current -= interval
        const opcode = moveQueueRef.current.shift()
        const action = OPCODE_ACTIONS[opcode]
        if (action && stateRef.current) {
          updateState(action(stateRef.current))
        }
      }
    }

    // After all moves executed, clear piece key so we recompute for next piece
    if (moveQueueRef.current.length === 0) {
      lastPieceRef.current = null
    }
  }, [stateRef, updateState])

  return executeMoves
}
