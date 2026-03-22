import { PIECE_SHAPES, EMPTY, MAX_BOARD_WIDTH, MIN_BOARD_WIDTH, createBag } from './types.js'
import { createBoard, checkCollision, placePiece, clearLines, getCell } from './board.js'
import { rotateCW, rotateCCW } from './pieces.js'
import { createScoring, addLineClears, addSoftDrop, addHardDrop } from './scoring.js'

const NEXT_QUEUE_SIZE = 5

function fillQueue(queue) {
  const result = [...queue]
  while (result.length < NEXT_QUEUE_SIZE + 1) {
    result.push(...createBag())
  }
  return result
}

function spawnPiece(type, width) {
  // Spawn at top-center
  const shape = PIECE_SHAPES[type][0]
  const cols = shape.map(([, c]) => c)
  const pieceWidth = Math.max(...cols) - Math.min(...cols) + 1
  const col = Math.floor((width - pieceWidth) / 2)
  return { type, rotation: 0, row: 0, col }
}

function calculateGhostRow(board, piece) {
  let ghostRow = piece.row
  while (true) {
    const candidate = { ...piece, row: ghostRow + 1 }
    if (checkCollision({ width: board.width, height: board.height, cells: board.cells }, candidate)) {
      break
    }
    ghostRow++
  }
  return ghostRow
}

function makeState(board, current, hold, canHold, nextQueue, scoring, gameOver) {
  const ghostRow = gameOver ? current.row : calculateGhostRow(board, current)
  return {
    board: board.cells,
    width: board.width,
    height: board.height,
    current,
    hold,
    canHold,
    nextQueue: nextQueue.slice(0, NEXT_QUEUE_SIZE),
    score: scoring.score,
    level: scoring.level,
    linesCleared: scoring.linesCleared,
    gameOver,
    ghostRow,
  }
}

function boardFromState(state) {
  return { width: state.width, height: state.height, cells: state.board }
}

function scoringFromState(state) {
  return { score: state.score, level: state.level, linesCleared: state.linesCleared }
}

export function createGame(width, height) {
  const board = createBoard(width, height)
  const queue = fillQueue([])
  const pieceType = queue.shift()
  const current = spawnPiece(pieceType, width)
  const nextQueue = fillQueue(queue)
  const scoring = createScoring()
  return makeState(board, current, null, true, nextQueue, scoring, false)
}

export function moveLeft(state) {
  if (state.gameOver) return state
  const board = boardFromState(state)
  const candidate = { ...state.current, col: state.current.col - 1 }
  if (checkCollision(board, candidate)) return state
  return makeState(board, candidate, state.hold, state.canHold, [...state.nextQueue], scoringFromState(state), false)
}

export function moveRight(state) {
  if (state.gameOver) return state
  const board = boardFromState(state)
  const candidate = { ...state.current, col: state.current.col + 1 }
  if (checkCollision(board, candidate)) return state
  return makeState(board, candidate, state.hold, state.canHold, [...state.nextQueue], scoringFromState(state), false)
}

export function rotateClockwise(state) {
  if (state.gameOver) return state
  const board = boardFromState(state)
  const result = rotateCW(board, state.current)
  if (result === null) return state
  return makeState(board, result, state.hold, state.canHold, [...state.nextQueue], scoringFromState(state), false)
}

export function rotateCounterClockwise(state) {
  if (state.gameOver) return state
  const board = boardFromState(state)
  const result = rotateCCW(board, state.current)
  if (result === null) return state
  return makeState(board, result, state.hold, state.canHold, [...state.nextQueue], scoringFromState(state), false)
}

function lockAndSpawn(state, board, scoring) {
  const placed = placePiece(board, state.current)
  const { board: cleared, linesCleared } = clearLines(placed)
  const newScoring = linesCleared > 0 ? addLineClears(scoring, linesCleared) : scoring

  const queue = fillQueue([...state.nextQueue])
  const nextType = queue.shift()
  const nextPiece = spawnPiece(nextType, cleared.width)
  const gameOver = checkCollision(cleared, nextPiece)

  return makeState(cleared, nextPiece, state.hold, true, queue, newScoring, gameOver)
}

export function softDrop(state) {
  if (state.gameOver) return state
  const board = boardFromState(state)
  const candidate = { ...state.current, row: state.current.row + 1 }
  if (checkCollision(board, candidate)) {
    // Lock the piece
    return lockAndSpawn(state, board, scoringFromState(state))
  }
  const scoring = addSoftDrop(scoringFromState(state), 1)
  return makeState(board, candidate, state.hold, state.canHold, [...state.nextQueue], scoring, false)
}

export function hardDrop(state) {
  if (state.gameOver) return state
  const board = boardFromState(state)
  const distance = state.ghostRow - state.current.row
  const landed = { ...state.current, row: state.ghostRow }
  const scoring = addHardDrop(scoringFromState(state), distance)

  const stateAtBottom = { ...state, current: landed }
  return lockAndSpawn(stateAtBottom, board, scoring)
}

export function holdPiece(state) {
  if (state.gameOver || !state.canHold) return state
  const board = boardFromState(state)
  const scoring = scoringFromState(state)

  if (state.hold === null) {
    // First hold: stash current, pull from queue
    const queue = fillQueue([...state.nextQueue])
    const nextType = queue.shift()
    const nextPiece = spawnPiece(nextType, state.width)
    return makeState(board, nextPiece, state.current.type, false, queue, scoring, false)
  }

  // Swap: current goes to hold, hold comes out
  const newPiece = spawnPiece(state.hold, state.width)
  if (checkCollision(board, newPiece)) return state
  return makeState(board, newPiece, state.current.type, false, [...state.nextQueue], scoring, false)
}

export function tick(state) {
  if (state.gameOver) return state
  const board = boardFromState(state)
  const candidate = { ...state.current, row: state.current.row + 1 }
  if (checkCollision(board, candidate)) {
    return lockAndSpawn(state, board, scoringFromState(state))
  }
  return makeState(board, candidate, state.hold, state.canHold, [...state.nextQueue], scoringFromState(state), false)
}

export function resizeBoard(state, newWidth) {
  const clampedWidth = Math.max(MIN_BOARD_WIDTH, Math.min(newWidth, MAX_BOARD_WIDTH))
  if (clampedWidth === state.width) return state

  const oldBoard = boardFromState(state)
  const newBoard = createBoard(clampedWidth, state.height)
  const cells = newBoard.cells

  // Copy existing content, centering it in the new width
  const offset = Math.floor((clampedWidth - state.width) / 2)

  for (let row = 0; row < state.height; row++) {
    for (let col = 0; col < state.width; col++) {
      const newCol = col + offset
      if (newCol >= 0 && newCol < clampedWidth) {
        const value = getCell(oldBoard, row, col)
        if (value !== EMPTY) {
          cells[row * clampedWidth + newCol] = value
        }
      }
    }
  }

  const board = { width: clampedWidth, height: state.height, cells }
  // Re-center current piece
  const current = { ...state.current, col: state.current.col + offset }
  const scoring = scoringFromState(state)

  return makeState(board, current, state.hold, state.canHold, [...state.nextQueue], scoring, state.gameOver)
}
