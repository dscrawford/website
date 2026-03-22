// WASM-swappable interface layer.
// When Rust/WASM is ready, replace imports here (or use a Vite alias).
// All consumers import from this file — never directly from engine.js.

export {
  createGame,
  moveLeft,
  moveRight,
  rotateClockwise,
  rotateCounterClockwise,
  softDrop,
  hardDrop,
  holdPiece,
  tick,
  resizeBoard,
} from './engine.js'
