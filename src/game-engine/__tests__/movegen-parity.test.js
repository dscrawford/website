import { describe, it, expect } from 'vitest'
import {
  moveLeft,
  moveRight,
  softDrop,
  hardDrop,
  rotateClockwise,
  rotateCounterClockwise,
  holdPiece,
} from '../engine.js'
import { PIECE_TYPES, EMPTY } from '../types.js'

// Parity check with the Rust solver's reachability search (movegen.rs):
// these opcode paths are the exact BFS output for the same boards
// (see movegen.rs tests finds_tuck_under_overhang / finds_tspin_double_*).
// The engine must execute them to the same final piece position.

const W = 10
const H = 20

const OPS = {
  0: moveLeft,
  1: moveRight,
  2: rotateClockwise,
  3: rotateCounterClockwise,
  5: holdPiece,
  6: softDrop,
}

function makeTestState(cells, piece) {
  return {
    board: cells,
    width: W,
    height: H,
    current: piece,
    hold: null,
    canHold: true,
    nextQueue: [PIECE_TYPES.I, PIECE_TYPES.O, PIECE_TYPES.S],
    score: 0,
    level: 0,
    linesCleared: 0,
    gameOver: false,
    ghostRow: piece.row,
    lockTimer: 0,
    lockResets: 0,
  }
}

function set(cells, row, col) {
  cells[row * W + col] = PIECE_TYPES.I
}

function runPath(state, path) {
  for (const op of path) {
    const next = OPS[op](state)
    expect(next.current, `opcode ${op} was a no-op`).not.toBe(state.current)
    state = next
  }
  return state
}

describe('movegen parity — Rust paths execute identically in the JS engine', () => {
  it('executes the tuck path under an overhang', () => {
    const cells = new Uint8Array(W * H)
    for (let c = 4; c < W; c++) set(cells, 16, c)
    for (let r = 17; r < H; r++) set(cells, r, 9)

    const spawn = { type: PIECE_TYPES.T, rotation: 0, row: 0, col: 3 }
    const path = [0, 0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 1, 6, 1, 1, 1, 6]

    const state = runPath(makeTestState(cells, spawn), path)
    expect(state.current).toMatchObject({ type: PIECE_TYPES.T, rotation: 0, row: 18, col: 5 })
  })

  it('executes the T-spin double path and clears two lines', () => {
    const cells = new Uint8Array(W * H)
    set(cells, 17, 5)
    for (let c = 0; c < W; c++) if (![3, 4, 5].includes(c)) set(cells, 18, c)
    for (let c = 0; c < W; c++) if (c !== 4) set(cells, 19, c)

    const spawn = { type: PIECE_TYPES.T, rotation: 0, row: 0, col: 3 }
    const path = [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 3, 6, 6, 3]

    let state = runPath(makeTestState(cells, spawn), path)
    expect(state.current).toMatchObject({ type: PIECE_TYPES.T, rotation: 2, row: 17, col: 3 })

    state = hardDrop(state)
    expect(state.linesCleared).toBe(2)
    // Slot cells consumed by the clear; nothing left of the T above row 18
    for (let c = 3; c <= 5; c++) {
      expect(state.board[16 * W + c]).toBe(EMPTY)
    }
  })
})

describe.each([
  {
    name: 'first hold takes the queue piece',
    initialHold: null,
    initialCurrent: { type: PIECE_TYPES.I, rotation: 0, row: 0, col: 3 },
    nextQueue: [PIECE_TYPES.T, PIECE_TYPES.O, PIECE_TYPES.S],
    expectedHold: PIECE_TYPES.I,
    expectedCurrent: { type: PIECE_TYPES.T, rotation: 0, row: 18, col: 3 },
  },
  {
    name: 'swap hold releases the held piece',
    initialHold: PIECE_TYPES.I,
    initialCurrent: { type: PIECE_TYPES.O, rotation: 0, row: 0, col: 4 },
    nextQueue: [PIECE_TYPES.T, PIECE_TYPES.S, PIECE_TYPES.Z],
    expectedHold: PIECE_TYPES.O,
    expectedCurrent: { type: PIECE_TYPES.I, rotation: 0, row: 18, col: 3 },
  },
])('movegen parity — HOLD-prefixed paths ($name)', (c) => {
  it('executes HOLD then the swapped-in piece path', () => {
    const cells = new Uint8Array(W * H)
    const state = makeTestState(cells, c.initialCurrent)
    state.hold = c.initialHold
    state.nextQueue = c.nextQueue

    // Mirrors assemble_moves(path, use_hold=true): HOLD, then the BFS path
    // for the swapped-in piece (straight soft-drop on an empty board)
    const path = [5, ...Array(18).fill(6)]

    const after = runPath(state, path)
    expect(after.hold).toBe(c.expectedHold)
    expect(after.canHold).toBe(false)
    expect(after.current).toMatchObject(c.expectedCurrent)
  })
})
