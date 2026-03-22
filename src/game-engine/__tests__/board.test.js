import { describe, it, expect } from 'vitest'
import {
  createBoard,
  getCell,
  setCell,
  checkCollision,
  placePiece,
  clearLines,
  isRowFull,
} from '../board.js'
import { PIECE_TYPES, PIECE_SHAPES, EMPTY, BOARD_HEIGHT } from '../types.js'

describe('board — createBoard', () => {
  it('creates a board with the given dimensions', () => {
    const board = createBoard(10, 20)
    expect(board.width).toBe(10)
    expect(board.height).toBe(20)
    expect(board.cells).toBeInstanceOf(Uint8Array)
    expect(board.cells.length).toBe(10 * 20)
  })

  it('initializes all cells to EMPTY', () => {
    const board = createBoard(10, 20)
    for (let i = 0; i < board.cells.length; i++) {
      expect(board.cells[i]).toBe(EMPTY)
    }
  })

  it('creates boards of varying widths', () => {
    const narrow = createBoard(10, 40)
    const wide = createBoard(200, 40)
    expect(narrow.cells.length).toBe(400)
    expect(wide.cells.length).toBe(8000)
  })
})

describe('board — getCell / setCell', () => {
  it('getCell returns EMPTY on a fresh board', () => {
    const board = createBoard(10, 20)
    expect(getCell(board, 0, 0)).toBe(EMPTY)
    expect(getCell(board, 19, 9)).toBe(EMPTY)
  })

  it('setCell returns a new board with the cell set', () => {
    const board = createBoard(10, 20)
    const updated = setCell(board, 5, 3, PIECE_TYPES.T)
    expect(getCell(updated, 5, 3)).toBe(PIECE_TYPES.T)
    // Original is unchanged (immutability)
    expect(getCell(board, 5, 3)).toBe(EMPTY)
  })

  it('getCell returns EMPTY for out-of-bounds (above board)', () => {
    const board = createBoard(10, 20)
    expect(getCell(board, -1, 5)).toBe(EMPTY)
  })

  it('getCell returns undefined for out-of-bounds (below/sides)', () => {
    const board = createBoard(10, 20)
    expect(getCell(board, 20, 5)).toBeUndefined()
    expect(getCell(board, 5, -1)).toBeUndefined()
    expect(getCell(board, 5, 10)).toBeUndefined()
  })
})

describe('board — checkCollision', () => {
  it('returns false for a piece in open space', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 0, col: 3 }
    expect(checkCollision(board, piece)).toBe(false)
  })

  it('returns true when piece is below the board', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 19, col: 3 }
    expect(checkCollision(board, piece)).toBe(true)
  })

  it('returns true when piece overlaps existing cells', () => {
    const board = createBoard(10, 20)
    const filled = setCell(board, 1, 4, PIECE_TYPES.I)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 0, col: 3 }
    expect(checkCollision(filled, piece)).toBe(true)
  })

  it('returns true when piece extends left of board', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: -1 }
    expect(checkCollision(board, piece)).toBe(true)
  })

  it('returns true when piece extends right of board', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 8 }
    expect(checkCollision(board, piece)).toBe(true)
  })

  it('returns false when piece is at valid edge', () => {
    const board = createBoard(10, 20)
    // T piece rotation 0: offsets [0,1],[1,0],[1,1],[1,2] — at col 0, rightmost is col 2
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 0 }
    expect(checkCollision(board, piece)).toBe(false)
  })
})

describe('board — placePiece', () => {
  it('returns a new board with the piece cells filled', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 3 }
    const result = placePiece(board, piece)
    // T piece rotation 0: [0,1],[1,0],[1,1],[1,2] relative to origin
    expect(getCell(result, 5, 4)).toBe(PIECE_TYPES.T) // row+0, col+1
    expect(getCell(result, 6, 3)).toBe(PIECE_TYPES.T) // row+1, col+0
    expect(getCell(result, 6, 4)).toBe(PIECE_TYPES.T) // row+1, col+1
    expect(getCell(result, 6, 5)).toBe(PIECE_TYPES.T) // row+1, col+2
    // Original unchanged
    expect(getCell(board, 5, 4)).toBe(EMPTY)
  })
})

describe('board — isRowFull', () => {
  it('returns false for an empty row', () => {
    const board = createBoard(10, 20)
    expect(isRowFull(board, 19)).toBe(false)
  })

  it('returns true when every cell in a row is filled', () => {
    let board = createBoard(10, 20)
    for (let col = 0; col < 10; col++) {
      board = setCell(board, 19, col, PIECE_TYPES.I)
    }
    expect(isRowFull(board, 19)).toBe(true)
  })

  it('returns false when one cell in the row is empty', () => {
    let board = createBoard(10, 20)
    for (let col = 0; col < 9; col++) {
      board = setCell(board, 19, col, PIECE_TYPES.I)
    }
    expect(isRowFull(board, 19)).toBe(false)
  })
})

describe('board — clearLines', () => {
  it('clears a single full row and shifts rows down', () => {
    let board = createBoard(10, 20)
    // Fill bottom row completely
    for (let col = 0; col < 10; col++) {
      board = setCell(board, 19, col, PIECE_TYPES.I)
    }
    // Place a marker in row 18
    board = setCell(board, 18, 0, PIECE_TYPES.T)

    const { board: cleared, linesCleared } = clearLines(board)
    expect(linesCleared).toBe(1)
    // Row 18 marker should now be at row 19
    expect(getCell(cleared, 19, 0)).toBe(PIECE_TYPES.T)
    // Top row should be empty
    expect(getCell(cleared, 0, 0)).toBe(EMPTY)
  })

  it('clears multiple full rows at once', () => {
    let board = createBoard(10, 20)
    // Fill rows 18 and 19
    for (let col = 0; col < 10; col++) {
      board = setCell(board, 18, col, PIECE_TYPES.I)
      board = setCell(board, 19, col, PIECE_TYPES.I)
    }
    // Place a marker in row 17
    board = setCell(board, 17, 5, PIECE_TYPES.S)

    const { board: cleared, linesCleared } = clearLines(board)
    expect(linesCleared).toBe(2)
    // Marker shifts from 17 to 19
    expect(getCell(cleared, 19, 5)).toBe(PIECE_TYPES.S)
  })

  it('returns 0 lines cleared when no rows are full', () => {
    const board = createBoard(10, 20)
    const { board: same, linesCleared } = clearLines(board)
    expect(linesCleared).toBe(0)
    expect(same.cells).toEqual(board.cells)
  })

  it('does not mutate the original board', () => {
    let board = createBoard(10, 20)
    for (let col = 0; col < 10; col++) {
      board = setCell(board, 19, col, PIECE_TYPES.I)
    }
    const original = new Uint8Array(board.cells)
    clearLines(board)
    expect(board.cells).toEqual(original)
  })
})
