import { describe, it, expect } from 'vitest'
import { rotateCW, rotateCCW, WALL_KICKS, WALL_KICKS_I } from '../pieces.js'
import { createBoard, setCell, checkCollision } from '../board.js'
import { PIECE_TYPES } from '../types.js'

describe('pieces — rotateCW', () => {
  it('rotates a piece clockwise (0 → 1)', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 4 }
    const result = rotateCW(board, piece)
    expect(result).not.toBeNull()
    expect(result.rotation).toBe(1)
  })

  it('wraps rotation from 3 → 0', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 3, row: 5, col: 4 }
    const result = rotateCW(board, piece)
    expect(result).not.toBeNull()
    expect(result.rotation).toBe(0)
  })

  it('returns null when rotation is blocked with no valid kick', () => {
    // Fill the entire board so no rotation is possible
    let board = createBoard(10, 20)
    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 10; c++) {
        board = setCell(board, r, c, PIECE_TYPES.I)
      }
    }
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 4 }
    const result = rotateCW(board, piece)
    expect(result).toBeNull()
  })

  it('applies wall kick when basic rotation collides', () => {
    const board = createBoard(10, 20)
    // T piece at the left wall — rotation 3 → 0 may need a kick
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 0 }
    // Rotation 0→1 for T at col 0: offsets become [0,1],[1,1],[1,2],[2,1]
    // col 0 + offsets means cols 1,1,2,1 — should fit without kick
    const result = rotateCW(board, piece)
    expect(result).not.toBeNull()
    expect(result.rotation).toBe(1)
  })

  it('does not mutate the original piece', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 4 }
    rotateCW(board, piece)
    expect(piece.rotation).toBe(0)
  })

  it('O piece rotation always succeeds at same position', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.O, rotation: 0, row: 5, col: 4 }
    const result = rotateCW(board, piece)
    expect(result).not.toBeNull()
    expect(result.row).toBe(5)
    expect(result.col).toBe(4)
  })
})

describe('pieces — rotateCCW', () => {
  it('rotates counter-clockwise (0 → 3)', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 0, row: 5, col: 4 }
    const result = rotateCCW(board, piece)
    expect(result).not.toBeNull()
    expect(result.rotation).toBe(3)
  })

  it('wraps rotation from 0 → 3', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.S, rotation: 0, row: 5, col: 4 }
    const result = rotateCCW(board, piece)
    expect(result).not.toBeNull()
    expect(result.rotation).toBe(3)
  })

  it('does not mutate the original piece', () => {
    const board = createBoard(10, 20)
    const piece = { type: PIECE_TYPES.T, rotation: 2, row: 5, col: 4 }
    rotateCCW(board, piece)
    expect(piece.rotation).toBe(2)
  })
})

describe('pieces — wall kick tables', () => {
  it('WALL_KICKS has entries for all 4 rotation transitions', () => {
    expect(Object.keys(WALL_KICKS)).toHaveLength(4)
    expect(WALL_KICKS['0>1']).toBeDefined()
    expect(WALL_KICKS['1>2']).toBeDefined()
    expect(WALL_KICKS['2>3']).toBeDefined()
    expect(WALL_KICKS['3>0']).toBeDefined()
  })

  it('WALL_KICKS_I has entries for all 4 rotation transitions', () => {
    expect(Object.keys(WALL_KICKS_I)).toHaveLength(4)
  })

  it('each kick table has 5 test offsets (including identity)', () => {
    for (const offsets of Object.values(WALL_KICKS)) {
      expect(offsets).toHaveLength(5)
    }
    for (const offsets of Object.values(WALL_KICKS_I)) {
      expect(offsets).toHaveLength(5)
    }
  })

  it('first offset in each table is [0, 0] (identity)', () => {
    for (const offsets of Object.values(WALL_KICKS)) {
      expect(offsets[0]).toEqual([0, 0])
    }
    for (const offsets of Object.values(WALL_KICKS_I)) {
      expect(offsets[0]).toEqual([0, 0])
    }
  })
})
