import { PIECE_TYPES } from './types.js'
import { checkCollision } from './board.js'

// SRS wall kick offsets for J, L, S, T, Z pieces
// Key: "fromRotation>toRotation", value: array of [rowOffset, colOffset]
export const WALL_KICKS = Object.freeze({
  '0>1': [[0, 0], [0, -1], [-1, -1], [2, 0], [2, -1]],
  '1>2': [[0, 0], [0, 1], [1, 1], [-2, 0], [-2, 1]],
  '2>3': [[0, 0], [0, 1], [-1, 1], [2, 0], [2, 1]],
  '3>0': [[0, 0], [0, -1], [1, -1], [-2, 0], [-2, -1]],
})

// SRS wall kick offsets for I piece
export const WALL_KICKS_I = Object.freeze({
  '0>1': [[0, 0], [0, -2], [0, 1], [1, -2], [-2, 1]],
  '1>2': [[0, 0], [0, -1], [0, 2], [-2, -1], [1, 2]],
  '2>3': [[0, 0], [0, 2], [0, -1], [-1, 2], [2, -1]],
  '3>0': [[0, 0], [0, 1], [0, -2], [2, 1], [-1, -2]],
})

// Reverse kick tables for CCW rotation
const WALL_KICKS_CCW = Object.freeze({
  '1>0': [[0, 0], [0, 1], [1, 1], [-2, 0], [-2, 1]],
  '2>1': [[0, 0], [0, -1], [-1, -1], [2, 0], [2, -1]],
  '3>2': [[0, 0], [0, -1], [1, -1], [-2, 0], [-2, -1]],
  '0>3': [[0, 0], [0, 1], [-1, 1], [2, 0], [2, 1]],
})

const WALL_KICKS_I_CCW = Object.freeze({
  '1>0': [[0, 0], [0, 2], [0, -1], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [0, 1], [0, -2], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [0, -2], [0, 1], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [0, -1], [0, 2], [-2, -1], [1, 2]],
})

function getKickTable(pieceType, fromRot, toRot, clockwise) {
  const key = `${fromRot}>${toRot}`
  if (pieceType === PIECE_TYPES.I) {
    return clockwise ? WALL_KICKS_I[key] : WALL_KICKS_I_CCW[key]
  }
  return clockwise ? WALL_KICKS[key] : WALL_KICKS_CCW[key]
}

function tryRotate(board, piece, newRotation, clockwise) {
  const fromRot = piece.rotation
  const kicks = getKickTable(piece.type, fromRot, newRotation, clockwise)

  for (const [dr, dc] of kicks) {
    const candidate = {
      type: piece.type,
      rotation: newRotation,
      row: piece.row + dr,
      col: piece.col + dc,
    }
    if (!checkCollision(board, candidate)) {
      return candidate
    }
  }
  return null
}

export function rotateCW(board, piece) {
  const newRotation = (piece.rotation + 1) % 4
  return tryRotate(board, piece, newRotation, true)
}

export function rotateCCW(board, piece) {
  const newRotation = (piece.rotation + 3) % 4
  return tryRotate(board, piece, newRotation, false)
}
