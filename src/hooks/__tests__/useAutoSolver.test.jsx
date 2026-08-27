// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const engineMocks = vi.hoisted(() => ({
  initSolver: vi.fn(),
  solveMoves: vi.fn(),
  moveLeft: vi.fn((s) => ({ ...s })),
  moveRight: vi.fn((s) => ({ ...s })),
  rotateClockwise: vi.fn((s) => ({ ...s })),
  rotateCounterClockwise: vi.fn((s) => ({ ...s })),
  hardDrop: vi.fn((s) => ({ ...s })),
  softDrop: vi.fn((s) => ({ ...s })),
  holdPiece: vi.fn((s) => ({ ...s })),
  createGame: vi.fn((width, height) => baseState({ width, height })),
}))

vi.mock('../../game-engine/engine-interface.js', () => engineMocks)

import { useAutoSolver, TELEPORT_SPEED_THRESHOLD } from '../useAutoSolver.js'

const OPCODE_LEFT = 0
const OPCODE_HARD_DROP = 4

function baseState(overrides = {}) {
  return {
    width: 10,
    height: 20,
    board: new Array(200).fill(0),
    current: { type: 1, rotation: 0, row: 0, col: 4 },
    nextQueue: [2, 3],
    hold: -1,
    canHold: true,
    gameOver: false,
    score: 0,
    level: 0,
    linesCleared: 0,
    ...overrides,
  }
}

async function setup(speed, initialState = baseState()) {
  engineMocks.initSolver.mockResolvedValue({})
  const stateRef = { current: initialState }
  const updateState = vi.fn((s) => {
    stateRef.current = s
  })
  const { result } = renderHook(() => useAutoSolver(stateRef, updateState, true, speed))
  // Flush initSolver().then(...) so the solver reads as ready
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return { stateRef, updateState, result }
}

describe('useAutoSolver — animated vs teleport threshold', () => {
  beforeEach(() => {
    engineMocks.solveMoves.mockReset()
    engineMocks.hardDrop.mockClear()
    engineMocks.createGame.mockClear()
  })

  it('exports the threshold matching the slider max', () => {
    expect(TELEPORT_SPEED_THRESHOLD).toBe(20)
  })

  it.each([1, 10, 19, 20])('speed %i stays animated: one solve per call', async (speed) => {
    engineMocks.solveMoves.mockReturnValue([OPCODE_HARD_DROP])
    const { result } = await setup(speed)
    act(() => {
      result.current.executeMoves(0)
    })
    expect(engineMocks.solveMoves).toHaveBeenCalledTimes(1)
  })

  it.each([21, 999])('speed %i teleports: up to 3 pieces per call', async (speed) => {
    engineMocks.solveMoves.mockImplementation(() => [OPCODE_HARD_DROP])
    const { result } = await setup(speed)
    act(() => {
      result.current.executeMoves(0)
    })
    expect(engineMocks.solveMoves).toHaveBeenCalledTimes(3)
  })

  it('animated path with zero elapsed time executes no queued move', async () => {
    engineMocks.solveMoves.mockReturnValue([OPCODE_LEFT])
    const { result, updateState } = await setup(20)
    act(() => {
      result.current.executeMoves(0)
    })
    expect(updateState).not.toHaveBeenCalled()
  })

  it('teleport path skips updateState when the solver finds nothing', async () => {
    engineMocks.solveMoves.mockReturnValue(null)
    const { result, updateState } = await setup(999)
    act(() => {
      result.current.executeMoves(0)
    })
    expect(engineMocks.solveMoves).toHaveBeenCalledTimes(1)
    expect(updateState).not.toHaveBeenCalled()
  })

  it('gameOver restarts the game before any solving', async () => {
    const { result } = await setup(999, baseState({ gameOver: true }))
    act(() => {
      result.current.executeMoves(0)
    })
    expect(engineMocks.createGame).toHaveBeenCalledWith(10, 40) // BOARD_HEIGHT
    expect(engineMocks.solveMoves).not.toHaveBeenCalled()
  })
})
