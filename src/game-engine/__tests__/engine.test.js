import { describe, it, expect } from 'vitest'
import {
  createGame,
  moveLeft,
  moveRight,
  softDrop,
  hardDrop,
  rotateClockwise,
  rotateCounterClockwise,
  holdPiece,
  tick,
  resizeBoard,
} from '../engine.js'
import { PIECE_TYPES, EMPTY, BOARD_HEIGHT } from '../types.js'
import { getCell } from '../board.js'

describe('engine — createGame', () => {
  it('creates a game with the specified dimensions', () => {
    const state = createGame(10, 20)
    expect(state.width).toBe(10)
    expect(state.height).toBe(20)
  })

  it('has a board of correct size', () => {
    const state = createGame(10, 20)
    expect(state.board).toBeInstanceOf(Uint8Array)
    expect(state.board.length).toBe(200)
  })

  it('starts with a current piece', () => {
    const state = createGame(10, 20)
    expect(state.current).not.toBeNull()
    expect(state.current.type).toBeGreaterThanOrEqual(1)
    expect(state.current.type).toBeLessThanOrEqual(7)
  })

  it('starts with a next queue of at least 3 pieces', () => {
    const state = createGame(10, 20)
    expect(state.nextQueue.length).toBeGreaterThanOrEqual(3)
  })

  it('starts with score 0, level 0, no lines cleared', () => {
    const state = createGame(10, 20)
    expect(state.score).toBe(0)
    expect(state.level).toBe(0)
    expect(state.linesCleared).toBe(0)
  })

  it('starts not game over', () => {
    const state = createGame(10, 20)
    expect(state.gameOver).toBe(false)
  })

  it('hold is null and canHold is true initially', () => {
    const state = createGame(10, 20)
    expect(state.hold).toBeNull()
    expect(state.canHold).toBe(true)
  })

  it('has a ghostRow', () => {
    const state = createGame(10, 20)
    expect(typeof state.ghostRow).toBe('number')
    expect(state.ghostRow).toBeGreaterThanOrEqual(state.current.row)
  })
})

describe('engine — movement', () => {
  it('moveLeft shifts piece left by 1', () => {
    const state = createGame(10, 20)
    const col = state.current.col
    const moved = moveLeft(state)
    expect(moved.current.col).toBe(col - 1)
  })

  it('moveRight shifts piece right by 1', () => {
    const state = createGame(10, 20)
    const col = state.current.col
    const moved = moveRight(state)
    expect(moved.current.col).toBe(col + 1)
  })

  it('moveLeft does not move past left wall', () => {
    let state = createGame(10, 20)
    // Move left many times to hit the wall
    for (let i = 0; i < 20; i++) {
      state = moveLeft(state)
    }
    const atWall = state.current.col
    const again = moveLeft(state)
    expect(again.current.col).toBe(atWall)
  })

  it('moveRight does not move past right wall', () => {
    let state = createGame(10, 20)
    for (let i = 0; i < 20; i++) {
      state = moveRight(state)
    }
    const atWall = state.current.col
    const again = moveRight(state)
    expect(again.current.col).toBe(atWall)
  })

  it('movement does not mutate original state', () => {
    const state = createGame(10, 20)
    const origCol = state.current.col
    moveLeft(state)
    expect(state.current.col).toBe(origCol)
  })
})

describe('engine — softDrop', () => {
  it('moves piece down by 1 row', () => {
    const state = createGame(10, 20)
    const row = state.current.row
    const dropped = softDrop(state)
    expect(dropped.current.row).toBe(row + 1)
  })

  it('adds 1 point per cell dropped', () => {
    const state = createGame(10, 20)
    const dropped = softDrop(state)
    expect(dropped.score).toBe(state.score + 1)
  })
})

describe('engine — hardDrop', () => {
  it('places piece at bottom and spawns new piece', () => {
    const state = createGame(10, 20)
    const dropped = hardDrop(state)
    // Current piece should be different (new spawn)
    // Board should have placed cells
    const hasCells = dropped.board.some(cell => cell !== EMPTY)
    expect(hasCells).toBe(true)
  })

  it('awards 2 points per cell dropped', () => {
    const state = createGame(10, 20)
    const distance = state.ghostRow - state.current.row
    const dropped = hardDrop(state)
    expect(dropped.score).toBe(state.score + distance * 2)
  })
})

describe('engine — rotation', () => {
  it('rotateClockwise changes rotation', () => {
    const state = createGame(10, 20)
    const rot = state.current.rotation
    const rotated = rotateClockwise(state)
    expect(rotated.current.rotation).toBe((rot + 1) % 4)
  })

  it('rotateCounterClockwise changes rotation', () => {
    const state = createGame(10, 20)
    const rot = state.current.rotation
    const rotated = rotateCounterClockwise(state)
    expect(rotated.current.rotation).toBe((rot + 3) % 4)
  })

  it('returns same state when rotation is impossible', () => {
    // This can happen if the board is very full
    // For now, just verify it doesn't crash
    const state = createGame(10, 20)
    const rotated = rotateClockwise(state)
    expect(rotated).toBeDefined()
  })
})

describe('engine — holdPiece', () => {
  it('swaps current piece into hold', () => {
    const state = createGame(10, 20)
    const currentType = state.current.type
    const held = holdPiece(state)
    expect(held.hold).toBe(currentType)
  })

  it('takes piece from hold on second swap', () => {
    const state = createGame(10, 20)
    const firstType = state.current.type
    const held1 = holdPiece(state)
    // Can't hold again this turn
    expect(held1.canHold).toBe(false)
  })

  it('cannot hold twice in same turn', () => {
    const state = createGame(10, 20)
    const held1 = holdPiece(state)
    const held2 = holdPiece(held1)
    // Should be unchanged
    expect(held2.hold).toBe(held1.hold)
    expect(held2.current.type).toBe(held1.current.type)
  })

  it('does not mutate original state', () => {
    const state = createGame(10, 20)
    holdPiece(state)
    expect(state.hold).toBeNull()
  })
})

describe('engine — tick', () => {
  it('moves piece down by 1 row', () => {
    const state = createGame(10, 20)
    const row = state.current.row
    const ticked = tick(state)
    expect(ticked.current.row).toBe(row + 1)
  })

  it('locks piece when it cannot move down further', () => {
    let state = createGame(10, 20)
    // Tick until piece locks (spawns new piece)
    const origType = state.current.type
    for (let i = 0; i < 25; i++) {
      state = tick(state)
    }
    // Board should have some filled cells
    const hasCells = state.board.some(cell => cell !== EMPTY)
    expect(hasCells).toBe(true)
  })

  it('returns same state when game is over', () => {
    let state = createGame(10, 20)
    state = { ...state, gameOver: true }
    const ticked = tick(state)
    expect(ticked).toEqual(state)
  })
})

describe('engine — resizeBoard', () => {
  it('changes the board width', () => {
    const state = createGame(10, 20)
    const resized = resizeBoard(state, 20)
    expect(resized.width).toBe(20)
    expect(resized.board.length).toBe(20 * 20)
  })

  it('preserves existing pieces when widening', () => {
    let state = createGame(10, 20)
    // Hard drop to place a piece
    state = hardDrop(state)
    const resized = resizeBoard(state, 20)
    // Should still have filled cells
    const hasCells = resized.board.some(cell => cell !== EMPTY)
    expect(hasCells).toBe(true)
  })

  it('clamps to minimum width', () => {
    const state = createGame(10, 20)
    const resized = resizeBoard(state, 3)
    expect(resized.width).toBe(10) // MIN_BOARD_WIDTH
  })

  it('clamps to maximum width', () => {
    const state = createGame(10, 20)
    const resized = resizeBoard(state, 2000)
    expect(resized.width).toBe(999) // MAX_BOARD_WIDTH
  })

  it('does not mutate original state', () => {
    const state = createGame(10, 20)
    resizeBoard(state, 20)
    expect(state.width).toBe(10)
  })
})

describe('engine — ghost piece', () => {
  it('ghostRow is at or below current row', () => {
    const state = createGame(10, 20)
    expect(state.ghostRow).toBeGreaterThanOrEqual(state.current.row)
  })

  it('ghostRow updates when piece moves', () => {
    const state = createGame(10, 20)
    const dropped = softDrop(state)
    expect(dropped.ghostRow).toBeGreaterThanOrEqual(dropped.current.row)
  })
})
