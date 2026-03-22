# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website for Daniel Crawford (danielcrawford.dev). A React 19 + Vite 8 frontend with a planned Rust/WASM Tetris game running as a full-screen AI-solved background. The center card overlays the game with name and resume link.

**Reference design:** `docs/reference.jpg` (save the Gemini-generated image here). See `docs/REFERENCE.md` for the full design spec including layout, sidebar stats, and game state targets.

## Build & Dev Commands

```bash
# Development
nix develop              # Enter dev shell (Node 22 + Rust 1.94 + wasm-pack)
npm run dev              # Vite dev server (HMR)
npm run build            # Production build → dist/
npm run preview          # Preview production build
npm run lint             # ESLint (flat config, JS/JSX)

# Testing (once configured)
npm test                 # Unit + integration tests (Vitest)
npm run test:e2e         # E2E tests (Playwright)
npm run test:coverage    # Coverage report (target: 80%+)

# Rust/WASM (when tetris-engine crate exists)
wasm-pack build --target web    # Build WASM module
```

## Architecture

- **Frontend:** React 19 (JSX, no TypeScript yet) with Vite, component CSS files
- **Backend:** Rust compiled to WASM via wasm-pack (planned — `wasm32-unknown-unknown` target configured in flake.nix)
- **Tetris engine:** Will be a Rust crate producing WASM, consumed by a React `<TetrisBackground>` component. The game auto-solves via AI algorithm, scaled to screen resolution (~40x80 grid or larger)
- **Styling:** Dark theme, glassmorphism center card, CSS grid-line placeholder for Tetris board. Colors: bg `#1a1a2e`, text `#e0e0e0`
- **Environment:** Nix flakes + direnv for reproducible polyglot dev (Node + Rust). `direnv allow` auto-loads the shell

## Development Methodology

**TDD is mandatory for all features:**
1. Write failing tests first (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor (IMPROVE)
4. Verify 80%+ coverage

**E2E tests required** for all user-visible features using Playwright. Test the landing page renders, resume link works, and Tetris background animates.

**All changes must be driven by the reference image** in `docs/reference.jpg`. Compare rendered output against the reference to validate visual fidelity.

## Key Design Targets (from reference image)

- Full-screen Tetris board background, ~60% filled from bottom, AI-solving
- Top-left: "DANIELCRAWFORD.DEV" + "GAMES | CODE | RESUME" nav
- Right sidebar: NEXT piece preview, SCORE, LEVEL display
- Center: frosted glass card with "DANIEL CRAWFORD" + "RESUME (PDF)" button
- Classic Tetris piece colors with neon glow effect
