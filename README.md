# dcraw.net

Personal website for Daniel Crawford — Senior Machine Learning Engineer and game dev hobbyist. Features a full-screen AI-solved Tetris game as the background with a frosted glass overlay card.

## Tech Stack

- **Frontend:** React 19, Vite 8, JSX
- **AI Solver:** Rust compiled to WASM via wasm-pack
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Dev Environment:** Nix Flakes + direnv (Node 22, Rust 1.94, Chromium)

## Getting Started

```bash
# Enter the dev shell (installs Node, Rust, wasm-pack, Chromium)
nix develop

# Build the WASM solver
npm run wasm:build

# Start dev server
npm run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit + integration tests |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run test:coverage` | Coverage report (target: 80%+) |
| `npm run wasm:build` | Build Rust solver to WASM |
| `npm run wasm:dev` | WASM debug build |

## Architecture

```
src/
├── components/          TopNav, CenterCard, TetrisBackground, TetrisSidebar
├── game-engine/         Tetris engine (board, pieces, scoring, engine-interface)
├── hooks/               useGameLoop, useAutoSolver, useInputHandler, useDynamicBoardSize
├── rendering/           Canvas renderer with neon glow effects
tetris-solver/           Rust crate → WASM AI solver
e2e/                     Playwright E2E tests
public/data/             Resume PDF (gitignored)
docs/                    Reference design image and spec
```

The game engine is pure JavaScript with an immutable state pattern (`state → newState`). The AI solver is a separate Rust crate that compiles to WASM and runs entirely in the browser — no server required. The `engine-interface.js` file is the swap point between JS and WASM.

## AI Solver

The Rust solver uses a two-phase El-Tetris heuristic strategy with a configurable target fill ratio (default 75%):

**Stacking phase** (below target): builds up the board cleanly, holding I-pieces for later.
**Scoring phase** (at/above target): uses I-pieces for 4-line Tetris clears.

Evaluation features (El-Tetris weights):
- Landing height, row/column transitions, holes, well sums, rows removed
- Rows-removed weight smoothly interpolated via sigmoid urgency curve
- Height-gap penalty pushes the board toward the target fill ratio
- Quadratic danger penalty when max column height exceeds 85% of board

Controls in the sidebar:
- **AI MODE** toggle (green ON / red OFF)
- **SPEED** input (1x–999x) — at 10x+, AI moves execute instantly per frame

## Production Build

The Nix flake includes a Docker image output:

```bash
nix build .#dockerImage       # produces ./result (OCI tarball)
docker load < result           # loads dcraw-website:latest
docker run -p 8080:80 dcraw-website:latest
```

The image uses nginx to serve the static Vite build with proper WASM MIME types, SPA fallback, and gzip compression.
