import { useRef, useCallback, useEffect } from 'react'
import { createGame, moveLeft, moveRight, softDrop, hardDrop, rotateClockwise, rotateCounterClockwise, holdPiece, tick, resizeBoard } from '../game-engine/engine-interface.js'
import { renderBoard } from '../rendering/canvas-renderer.js'
import { useDynamicBoardSize } from '../hooks/useDynamicBoardSize.js'
import { useGameLoop } from '../hooks/useGameLoop.js'
import { useInputHandler } from '../hooks/useInputHandler.js'
import { useAutoSolver } from '../hooks/useAutoSolver.js'
import { BOARD_HEIGHT } from '../game-engine/types.js'
import './TetrisBackground.css'

export default function TetrisBackground({ active, onStateChange, aiEnabled = true, speedMultiplier = 1, targetFillRatio = 0.75 }) {
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const prevWidthRef = useRef(null)
  const { cellSize, width } = useDynamicBoardSize(BOARD_HEIGHT)

  // Initialize game
  useEffect(() => {
    stateRef.current = createGame(width, BOARD_HEIGHT)
    prevWidthRef.current = width
    onStateChange?.(stateRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle resize
  useEffect(() => {
    if (prevWidthRef.current !== null && prevWidthRef.current !== width && stateRef.current) {
      stateRef.current = resizeBoard(stateRef.current, width)
      prevWidthRef.current = width
      onStateChange?.(stateRef.current)
    }
  }, [width, onStateChange])

  const updateState = useCallback((newState) => {
    stateRef.current = newState
    onStateChange?.(newState)
  }, [onStateChange])

  const onTick = useCallback(() => {
    if (stateRef.current) {
      updateState(tick(stateRef.current))
    }
  }, [updateState])

  const onRender = useCallback(() => {
    const canvas = canvasRef.current
    const state = stateRef.current
    if (!canvas || !state) return

    const dpr = window.devicePixelRatio || 1
    const displayW = state.width * cellSize
    const displayH = state.height * cellSize

    if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
      canvas.width = displayW * dpr
      canvas.height = displayH * dpr
      canvas.style.width = `${displayW}px`
      canvas.style.height = `${displayH}px`
    }

    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    renderBoard(ctx, state, cellSize, displayW, displayH)
  }, [cellSize])

  // Auto-solver: controlled by aiEnabled toggle (independent of card focus)
  const executeSolverMoves = useAutoSolver(stateRef, updateState, aiEnabled, speedMultiplier, targetFillRatio)

  const onFrame = useCallback((delta) => {
    executeSolverMoves(delta)
  }, [executeSolverMoves])

  useGameLoop(stateRef, onTick, onRender, false, onFrame, speedMultiplier)

  const actions = {
    moveLeft: () => { if (stateRef.current) updateState(moveLeft(stateRef.current)) },
    moveRight: () => { if (stateRef.current) updateState(moveRight(stateRef.current)) },
    softDrop: () => { if (stateRef.current) updateState(softDrop(stateRef.current)) },
    hardDrop: () => { if (stateRef.current) updateState(hardDrop(stateRef.current)) },
    rotateClockwise: () => { if (stateRef.current) updateState(rotateClockwise(stateRef.current)) },
    rotateCounterClockwise: () => { if (stateRef.current) updateState(rotateCounterClockwise(stateRef.current)) },
    holdPiece: () => { if (stateRef.current) updateState(holdPiece(stateRef.current)) },
  }

  useInputHandler(active, actions)

  return (
    <div className="tetris-background">
      <canvas ref={canvasRef} />
    </div>
  )
}
