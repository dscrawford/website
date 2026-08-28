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

// Speeds beyond the animated slider range fall back to instant placement
export const TELEPORT_SPEED_THRESHOLD = 20

// Hysteresis thresholds for the stacking/scoring cycle. STACK_TARGET is the
// fill the solver steers toward; the flip to scoring sits slightly below it
// because the solver's target attraction (and so the climb rate) vanishes at
// the target itself, so exactly-at-target is never reached.
const STACK_TARGET = 0.75  // solver target while stacking
const STACK_FLIP = 0.70    // fill at which we flip to scoring
const SCORE_TARGET = 0.10  // score down to 10% fill

// Mirrors evaluator_param::well_exempt_fill in the Rust solver: aggregate
// column height with the well column (rightmost lowest) exempted. Cell-count
// fill undercounts the stack (covered gaps, empty well) and would sit
// permanently below the flip threshold.
export function wellExemptFill(state) {
  const { board, width, height } = state
  let aggregate = 0
  let wellHeight = Infinity
  for (let col = 0; col < width; col++) {
    let h = 0
    for (let row = 0; row < height; row++) {
      if (board[row * width + col] !== 0) {
        h = height - row
        break
      }
    }
    aggregate += h
    if (h <= wellHeight) wellHeight = h
  }
  const colsExempt = Math.max(width - 1, 1)
  return Math.min((aggregate - wellHeight) / (colsExempt * height), 1)
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

  // Have we solved for the current piece?
  const hasSolvedRef = useRef(false)
  const waitingSnapRef = useRef(null)

  // Hysteresis mode: 'stacking' or 'scoring'
  const modeRef = useRef('stacking')

  // Exposed debug info for sidebar display
  const aiInfoRef = useRef({ mode: 'stacking', fill: 0, target: STACK_TARGET })

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
    modeRef.current = 'stacking'
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
      modeRef.current = 'stacking'
      return
    }

    // --- Update hysteresis mode based on current board fill ---
    const fill = wellExemptFill(state)
    if (modeRef.current === 'stacking' && fill >= STACK_FLIP) {
      modeRef.current = 'scoring'
    } else if (modeRef.current === 'scoring' && fill <= SCORE_TARGET) {
      modeRef.current = 'stacking'
    }

    const currentTarget = modeRef.current === 'stacking' ? STACK_TARGET : SCORE_TARGET
    aiInfoRef.current = { mode: modeRef.current, fill, target: currentTarget }
    window.__tetrisAI = aiInfoRef.current
    const speed = speedRef.current

    // --- TELEPORT PATH (beyond the animated slider range) ---
    if (speed > TELEPORT_SPEED_THRESHOLD) {
      let s = stateRef.current
      let iterations = 0
      const maxIterations = 3

      while (iterations < maxIterations && s && !s.gameOver) {
        // Recompute mode for each piece at high speed
        const f = wellExemptFill(s)
        if (modeRef.current === 'stacking' && f >= STACK_FLIP) {
          modeRef.current = 'scoring'
        } else if (modeRef.current === 'scoring' && f <= SCORE_TARGET) {
          modeRef.current = 'stacking'
        }
        const target = modeRef.current === 'stacking' ? STACK_TARGET : SCORE_TARGET

        if (moveQueueRef.current.length === 0) {
          const moves = solveMoves(s, target, strategyRef.current)
          if (!moves || moves.length === 0) break
          moveQueueRef.current = moves
        }

        while (moveQueueRef.current.length > 0) {
          const opcode = moveQueueRef.current.shift()
          const action = OPCODE_ACTIONS[opcode]
          if (action && s) s = action(s)
        }

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

    // --- ANIMATED PATH (slider range, 1-20x) ---

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
      const moves = solveMoves(state, currentTarget, strategyRef.current)
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

    // Phase 4: Hard drop to lock and move on
    if (moveQueueRef.current.length === 0 && hasSolvedRef.current && waitingSnapRef.current === null) {
      const locked = hardDrop(stateRef.current)
      updateState(locked)
      hasSolvedRef.current = false
    }
  }, [stateRef, updateState])

  return { executeMoves, aiInfoRef }
}
