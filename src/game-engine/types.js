// Piece type identifiers (1-7, 0 = empty)
export const EMPTY = 0

export const PIECE_TYPES = Object.freeze({
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
})

export const PIECE_NAMES = Object.freeze({
  [PIECE_TYPES.I]: 'I',
  [PIECE_TYPES.O]: 'O',
  [PIECE_TYPES.T]: 'T',
  [PIECE_TYPES.S]: 'S',
  [PIECE_TYPES.Z]: 'Z',
  [PIECE_TYPES.J]: 'J',
  [PIECE_TYPES.L]: 'L',
})

// Board constraints
export const BOARD_HEIGHT = 40
export const MAX_BOARD_WIDTH = 999
export const MIN_BOARD_WIDTH = 10

// Piece shapes: PIECE_SHAPES[type][rotation] = [[row, col], ...] (4 cells)
// Offsets are relative to the piece's origin. Using SRS-standard orientations.
export const PIECE_SHAPES = Object.freeze({
  // I piece
  [PIECE_TYPES.I]: [
    [[1, 0], [1, 1], [1, 2], [1, 3]],  // 0: horizontal
    [[0, 2], [1, 2], [2, 2], [3, 2]],  // R: vertical
    [[2, 0], [2, 1], [2, 2], [2, 3]],  // 2: horizontal (shifted)
    [[0, 1], [1, 1], [2, 1], [3, 1]],  // L: vertical (shifted)
  ],
  // O piece (same for all rotations)
  [PIECE_TYPES.O]: [
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [1, 2]],
  ],
  // T piece
  [PIECE_TYPES.T]: [
    [[0, 1], [1, 0], [1, 1], [1, 2]],  // 0: T pointing up
    [[0, 1], [1, 1], [1, 2], [2, 1]],  // R
    [[1, 0], [1, 1], [1, 2], [2, 1]],  // 2
    [[0, 1], [1, 0], [1, 1], [2, 1]],  // L
  ],
  // S piece
  [PIECE_TYPES.S]: [
    [[0, 1], [0, 2], [1, 0], [1, 1]],  // 0
    [[0, 1], [1, 1], [1, 2], [2, 2]],  // R
    [[1, 1], [1, 2], [2, 0], [2, 1]],  // 2
    [[0, 0], [1, 0], [1, 1], [2, 1]],  // L
  ],
  // Z piece
  [PIECE_TYPES.Z]: [
    [[0, 0], [0, 1], [1, 1], [1, 2]],  // 0
    [[0, 2], [1, 1], [1, 2], [2, 1]],  // R
    [[1, 0], [1, 1], [2, 1], [2, 2]],  // 2
    [[0, 1], [1, 0], [1, 1], [2, 0]],  // L
  ],
  // J piece
  [PIECE_TYPES.J]: [
    [[0, 0], [1, 0], [1, 1], [1, 2]],  // 0
    [[0, 1], [0, 2], [1, 1], [2, 1]],  // R
    [[1, 0], [1, 1], [1, 2], [2, 2]],  // 2
    [[0, 1], [1, 1], [2, 0], [2, 1]],  // L
  ],
  // L piece
  [PIECE_TYPES.L]: [
    [[0, 2], [1, 0], [1, 1], [1, 2]],  // 0
    [[0, 1], [1, 1], [2, 1], [2, 2]],  // R
    [[1, 0], [1, 1], [1, 2], [2, 0]],  // 2
    [[0, 0], [0, 1], [1, 1], [2, 1]],  // L
  ],
})

// 7-bag randomizer: returns a shuffled array of all 7 piece types
export function createBag() {
  const bag = [1, 2, 3, 4, 5, 6, 7]
  // Fisher-Yates shuffle
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = bag[i]
    bag[i] = bag[j]
    bag[j] = tmp
  }
  return bag
}
