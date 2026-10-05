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

import { useAutoSolver, TELEPORT_SPEED_THRESHOLD, wellExemptFill, stackTargetFor } from '../useAutoSolver.js'

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

function boardWithHeights(width, height, heights) {
  const board = new Array(width * height).fill(0)
  heights.forEach((h, col) => {
    for (let row = height - h; row < height; row++) board[row * width + col] = 1
  })
  return board
}

describe('wellExemptFill — mirrors evaluator_param::well_exempt_fill', () => {
  it('exempts the rightmost lowest column from the fill ratio', () => {
    const state = { width: 4, height: 4, board: boardWithHeights(4, 4, [2, 3, 1, 1]) }
    // aggregate 7, well = col 3 (rightmost of the two height-1 columns)
    expect(wellExemptFill(state)).toBeCloseTo((7 - 1) / (3 * 4), 10)
  })

  it('counts covered gaps as fill via column heights', () => {
    const state = { width: 2, height: 4, board: boardWithHeights(2, 4, [0, 0]) }
    state.board[1 * 2 + 0] = 1 // col 0: single cell at height 3, gap below
    expect(wellExemptFill(state)).toBeCloseTo(3 / 4, 10)
  })

  it('is 0 for an empty board and clamps at 1', () => {
    expect(wellExemptFill({ width: 5, height: 5, board: new Array(25).fill(0) })).toBe(0)
    expect(wellExemptFill({ width: 5, height: 5, board: new Array(25).fill(1) })).toBeLessThanOrEqual(1)
  })
})

describe('useAutoSolver — stack/score hysteresis', () => {
  beforeEach(() => {
    engineMocks.solveMoves.mockReset()
  })

  it('flips to scoring at the flip threshold and requests the score target', async () => {
    engineMocks.solveMoves.mockReturnValue([OPCODE_HARD_DROP])
    // Phone board (18 wide): cols 0-16 at height 15, well empty
    // -> 255/340 = 75% well-exempt fill, past the 70% flip
    const heights = [...new Array(17).fill(15), 0]
    const state = baseState({ width: 18, board: boardWithHeights(18, 20, heights) })
    const { result } = await setup(1, state)
    act(() => {
      result.current.executeMoves(0)
    })
    expect(engineMocks.solveMoves.mock.calls[0][1]).toBeCloseTo(0.10, 10)
  })

  it("keeps stacking toward the board's target below the flip threshold", async () => {
    engineMocks.solveMoves.mockReturnValue([OPCODE_HARD_DROP])
    // cols 0-16 at height 8: 136/340 = 40%, well under the phone board's flip
    const heights = [...new Array(17).fill(8), 0]
    const state = baseState({ width: 18, board: boardWithHeights(18, 20, heights) })
    const { result } = await setup(1, state)
    act(() => {
      result.current.executeMoves(0)
    })
    expect(engineMocks.solveMoves.mock.calls[0][1]).toBeCloseTo(stackTargetFor(18), 10)
  })

  it('asks a minimum-width board for its reduced target', async () => {
    engineMocks.solveMoves.mockReturnValue([OPCODE_HARD_DROP])
    // 10 wide: 9 stacking columns. cols 0-8 at height 6: 54/180 = 30%,
    // well under the flip, so the stacking target is requested
    const heights = [...new Array(9).fill(6), 0]
    const state = baseState({ board: boardWithHeights(10, 20, heights) })
    const { result } = await setup(1, state)
    act(() => {
      result.current.executeMoves(0)
    })
    expect(engineMocks.solveMoves.mock.calls[0][1]).toBeCloseTo(stackTargetFor(10), 10)
    expect(stackTargetFor(10)).toBeLessThan(stackTargetFor(18))
  })
})

describe('useAutoSolver — stackTargetFor across viewport board widths', () => {
  // Board widths the site produces: cell = floor(vh / 40),
  // width = clamp(floor(vw / cell), 10, 999)
  const VIEWPORT_WIDTHS = {
    'iPhone SE portrait': 23,
    'iPhone 14 portrait': 18,
    'iPhone 14 landscape': 93,
    'iPad portrait': 28,
    'iPad landscape': 59,
    'laptop / 1080p / 1440p': 71,
    ultrawide: 95,
  }

  it('reserves headroom for an I-piece drought: ~1 row on a widescreen, ~4 on a phone', () => {
    // 72 cells of non-I pieces spread over the stacking columns
    expect(stackTargetFor(71)).toBeCloseTo(0.75 - 72 / (70 * 40), 10)
    expect(stackTargetFor(18)).toBeCloseTo(0.75 - 72 / (17 * 40), 10)
    expect(stackTargetFor(10)).toBeCloseTo(0.75 - 72 / (9 * 40), 10)
  })

  it('keeps every real viewport board between a 55% and 75% stack', () => {
    for (const [label, width] of Object.entries(VIEWPORT_WIDTHS)) {
      const target = stackTargetFor(width)
      expect(target, label).toBeGreaterThanOrEqual(0.6)
      expect(target, label).toBeLessThan(0.75)
    }
    expect(stackTargetFor(10)).toBeGreaterThanOrEqual(0.55)
  })

  it('rises monotonically with width and never reaches the base target', () => {
    let prev = 0
    for (let width = 10; width <= 999; width++) {
      const target = stackTargetFor(width)
      expect(target).toBeGreaterThanOrEqual(prev)
      expect(target).toBeLessThan(0.75)
      prev = target
    }
  })

  it('scales with board height so the reserve is a fixed number of rows', () => {
    // Same 72 cells over 17 columns: 4.2 rows is a bigger share of 20 than of 40
    expect(stackTargetFor(18, 20)).toBeLessThan(stackTargetFor(18, 40))
    expect((0.75 - stackTargetFor(18, 20)) * 20).toBeCloseTo((0.75 - stackTargetFor(18, 40)) * 40, 10)
  })
})
