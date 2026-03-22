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

// --- AI Solver (Rust/WASM) ---

let wasmModule = null
let initPromise = null

export async function initSolver() {
  if (wasmModule) return wasmModule
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const wasm = await import('../tetris-solver-pkg/tetris_solver.js')
      // wasm-pack --target web requires calling the default init function
      if (typeof wasm.default === 'function') {
        await wasm.default()
      }
      wasmModule = wasm
      return wasm
    } catch (e) {
      console.warn('WASM solver failed to load, AI auto-solve disabled:', e)
      initPromise = null
      return null
    }
  })()

  return initPromise
}

export function solveMoves(state) {
  if (!wasmModule) return null
  try {
    const opcodes = wasmModule.solve(
      state.board,
      state.width,
      state.height,
      state.current.type,
      state.current.rotation,
      state.current.row,
      state.current.col,
      state.hold ?? -1,
      state.canHold,
      new Uint8Array(state.nextQueue),
    )
    return Array.from(opcodes)
  } catch (e) {
    console.warn('Solver error:', e)
    return null
  }
}
