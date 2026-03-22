import { EMPTY, PIECE_SHAPES } from './types.js'

export function createBoard(width, height) {
  return {
    width,
    height,
    cells: new Uint8Array(width * height),
  }
}

export function getCell(board, row, col) {
  if (row < 0) return EMPTY // above board is valid empty space
  if (row >= board.height || col < 0 || col >= board.width) return undefined
  return board.cells[row * board.width + col]
}

export function setCell(board, row, col, value) {
  const cells = new Uint8Array(board.cells)
  cells[row * board.width + col] = value
  return { width: board.width, height: board.height, cells }
}

export function checkCollision(board, piece) {
  const shape = PIECE_SHAPES[piece.type][piece.rotation]
  for (const [dr, dc] of shape) {
    const r = piece.row + dr
    const c = piece.col + dc
    const cell = getCell(board, r, c)
    if (cell === undefined || (cell !== EMPTY)) return true
  }
  return false
}

export function placePiece(board, piece) {
  const cells = new Uint8Array(board.cells)
  const shape = PIECE_SHAPES[piece.type][piece.rotation]
  for (const [dr, dc] of shape) {
    const r = piece.row + dr
    const c = piece.col + dc
    if (r >= 0 && r < board.height && c >= 0 && c < board.width) {
      cells[r * board.width + c] = piece.type
    }
  }
  return { width: board.width, height: board.height, cells }
}

export function isRowFull(board, row) {
  const start = row * board.width
  for (let col = 0; col < board.width; col++) {
    if (board.cells[start + col] === EMPTY) return false
  }
  return true
}

export function clearLines(board) {
  const fullRows = []
  for (let row = 0; row < board.height; row++) {
    if (isRowFull(board, row)) fullRows.push(row)
  }

  if (fullRows.length === 0) {
    return { board, linesCleared: 0 }
  }

  const cells = new Uint8Array(board.width * board.height)
  let destRow = board.height - 1

  for (let srcRow = board.height - 1; srcRow >= 0; srcRow--) {
    if (fullRows.includes(srcRow)) continue
    const srcStart = srcRow * board.width
    const destStart = destRow * board.width
    cells.set(board.cells.subarray(srcStart, srcStart + board.width), destStart)
    destRow--
  }
  // Remaining top rows are already zero (EMPTY)

  return {
    board: { width: board.width, height: board.height, cells },
    linesCleared: fullRows.length,
  }
}
