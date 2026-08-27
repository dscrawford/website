import { PIECE_COLORS, PIECE_GLOW_COLORS } from './colors.js'

// Pre-rendered glow-cell sprites: shadowBlur per cell re-renders the blur
// every frame, so blitting a baked sprite instead is a plain copy.
// Compositing is equivalent to each cell drawing its own shadow (source-over).

// Padding must cover the largest shadowBlur used
export const SPRITE_PAD = 12

let cache = null

function bakeCell(cellSize, dpr, color, glow, blur) {
  const size = (cellSize + SPRITE_PAD * 2) * dpr
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = color
  ctx.shadowColor = glow
  ctx.shadowBlur = blur
  ctx.fillRect(SPRITE_PAD + 1, SPRITE_PAD + 1, cellSize - 2, cellSize - 2)
  return canvas
}

/// Sprites for the given cell size/DPR, rebuilt only when either changes.
/// Returns null when canvas creation is unavailable (non-browser tests).
export function getCellSprites(cellSize, dpr) {
  if (typeof document === 'undefined') return null
  if (cache && cache.cellSize === cellSize && cache.dpr === dpr) return cache

  const placed = [null]
  const active = [null]
  for (let type = 1; type <= 7; type++) {
    placed.push(bakeCell(cellSize, dpr, PIECE_COLORS[type], PIECE_GLOW_COLORS[type], 6))
    active.push(bakeCell(cellSize, dpr, PIECE_COLORS[type], PIECE_GLOW_COLORS[type], 10))
  }
  cache = { cellSize, dpr, placed, active }
  return cache
}
