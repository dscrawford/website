import { PIECE_COLORS, PIECE_GLOW_COLORS, GRID_COLOR, BOARD_BG, GHOST_ALPHA } from './colors.js'
import { PIECE_SHAPES, EMPTY } from '../game-engine/types.js'
import { getCellSprites, SPRITE_PAD } from './cell-sprites.js'

export function renderBoard(ctx, state, cellSize, canvasWidth, canvasHeight, dpr = 1) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Background
  ctx.fillStyle = BOARD_BG
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  const sprites = getCellSprites(cellSize, dpr)

  drawPlacedCells(ctx, state, cellSize, sprites)
  drawGhostPiece(ctx, state, cellSize)
  drawCurrentPiece(ctx, state, cellSize, sprites)

  // Draw grid
  drawGrid(ctx, state.width, state.height, cellSize)
}

function drawPlacedCells(ctx, state, cellSize, sprites) {
  const spriteSize = cellSize + SPRITE_PAD * 2

  if (sprites) {
    // Single board pass; each cell is a plain sprite blit
    for (let i = 0; i < state.board.length; i++) {
      const type = state.board[i]
      if (type === EMPTY) continue
      const sprite = sprites.placed[type]
      if (!sprite) continue
      const row = (i / state.width) | 0
      const col = i % state.width
      ctx.drawImage(
        sprite,
        col * cellSize - SPRITE_PAD,
        row * cellSize - SPRITE_PAD,
        spriteSize,
        spriteSize
      )
    }
    return
  }

  // Fallback (non-browser tests): shadowed rects, batched by piece type
  for (let pieceType = 1; pieceType <= 7; pieceType++) {
    const color = PIECE_COLORS[pieceType]
    const glow = PIECE_GLOW_COLORS[pieceType]
    let hasCells = false

    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i] === pieceType) {
        if (!hasCells) {
          ctx.fillStyle = color
          ctx.shadowColor = glow
          ctx.shadowBlur = 6
          hasCells = true
        }
        const row = Math.floor(i / state.width)
        const col = i % state.width
        ctx.fillRect(col * cellSize + 1, row * cellSize + 1, cellSize - 2, cellSize - 2)
      }
    }
  }
  ctx.shadowBlur = 0
}

function drawCurrentPiece(ctx, state, cellSize, sprites) {
  if (!state.current || state.gameOver) return
  const { type, rotation, row, col } = state.current
  const shape = PIECE_SHAPES[type][rotation]

  if (sprites && sprites.active[type]) {
    const spriteSize = cellSize + SPRITE_PAD * 2
    for (const [dr, dc] of shape) {
      const r = row + dr
      const c = col + dc
      if (r >= 0 && r < state.height && c >= 0 && c < state.width) {
        ctx.drawImage(
          sprites.active[type],
          c * cellSize - SPRITE_PAD,
          r * cellSize - SPRITE_PAD,
          spriteSize,
          spriteSize
        )
      }
    }
    return
  }

  ctx.fillStyle = PIECE_COLORS[type]
  ctx.shadowColor = PIECE_GLOW_COLORS[type]
  ctx.shadowBlur = 10

  for (const [dr, dc] of shape) {
    const r = row + dr
    const c = col + dc
    if (r >= 0 && r < state.height && c >= 0 && c < state.width) {
      ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2)
    }
  }
  ctx.shadowBlur = 0
}

function drawGhostPiece(ctx, state, cellSize) {
  if (!state.current || state.gameOver) return
  if (state.ghostRow === state.current.row) return

  const { type, rotation, col } = state.current
  const shape = PIECE_SHAPES[type][rotation]

  ctx.save()
  ctx.globalAlpha = GHOST_ALPHA
  ctx.fillStyle = PIECE_COLORS[type]

  for (const [dr, dc] of shape) {
    const r = state.ghostRow + dr
    const c = col + dc
    if (r >= 0 && r < state.height && c >= 0 && c < state.width) {
      ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2)
    }
  }
  ctx.restore()
}

function drawGrid(ctx, width, height, cellSize) {
  ctx.beginPath()
  ctx.strokeStyle = GRID_COLOR
  ctx.lineWidth = 0.5

  // Vertical lines
  for (let col = 0; col <= width; col++) {
    const x = col * cellSize
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height * cellSize)
  }

  // Horizontal lines
  for (let row = 0; row <= height; row++) {
    const y = row * cellSize
    ctx.moveTo(0, y)
    ctx.lineTo(width * cellSize, y)
  }

  ctx.stroke()
}
