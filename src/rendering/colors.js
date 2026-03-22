// Classic Tetris piece colors with neon glow config
// Indexed by piece type (1-7), index 0 unused

export const PIECE_COLORS = Object.freeze([
  null,                    // 0: EMPTY
  '#00f0f0',              // 1: I — cyan
  '#f0f000',              // 2: O — yellow
  '#a000f0',              // 3: T — purple
  '#00f000',              // 4: S — green
  '#f00000',              // 5: Z — red
  '#0000f0',              // 6: J — blue
  '#f0a000',              // 7: L — orange
])

export const PIECE_GLOW_COLORS = Object.freeze([
  null,
  'rgba(0, 240, 240, 0.6)',   // I
  'rgba(240, 240, 0, 0.6)',   // O
  'rgba(160, 0, 240, 0.6)',   // T
  'rgba(0, 240, 0, 0.6)',     // S
  'rgba(240, 0, 0, 0.6)',     // Z
  'rgba(0, 0, 240, 0.6)',     // J
  'rgba(240, 160, 0, 0.6)',   // L
])

export const GRID_COLOR = 'rgba(255, 255, 255, 0.04)'
export const BOARD_BG = '#1a1a2e'
export const GHOST_ALPHA = 0.25
