import { test, expect } from '@playwright/test'

// Verify AI produces clean stacking across various seeds and board widths.
// Each test navigates with ?seed=N&width=W, lets the AI play at high speed,
// then verifies stacking quality: low holes, flat landscape, and survival.

const POLL_INTERVAL_MS = 100
const MAX_WAIT_MS = 60000
const MIN_SCORE = 2000 // Ensure enough pieces for meaningful stacking evaluation

// 10 seeds × varied widths (all 3n+1)
const TEST_CASES = [
  { seed: 1, width: 10 },
  { seed: 7, width: 10 },
  { seed: 42, width: 10 },
  { seed: 99, width: 13 },
  { seed: 123, width: 16 },
  { seed: 256, width: 19 },
  { seed: 500, width: 25 },
  { seed: 777, width: 40 },
  { seed: 1000, width: 100 },
  { seed: 9999, width: 997 },
]

// Analyze the board state for stacking quality
function analyzeBoardInBrowser(state) {
  const board = Array.from(state.board)
  const w = state.width
  const h = state.height

  // Column heights (ignoring the rightmost "open" column)
  const openCol = w - 1
  const heights = []
  for (let col = 0; col < w; col++) {
    let colHeight = 0
    for (let row = 0; row < h; row++) {
      if (board[row * w + col] !== 0) {
        colHeight = h - row
        break
      }
    }
    heights.push(colHeight)
  }

  // Holes: empty cells below a filled cell in same column
  let holes = 0
  for (let col = 0; col < w; col++) {
    let foundFilled = false
    for (let row = 0; row < h; row++) {
      const cell = board[row * w + col]
      if (cell !== 0) {
        foundFilled = true
      } else if (foundFilled) {
        holes++
      }
    }
  }

  // Bumpiness: sum of height differences between adjacent stacking columns
  // (excluding the open column from bumpiness calculation)
  const stackHeights = heights.filter((_, i) => i !== openCol)
  let bumpiness = 0
  for (let i = 1; i < stackHeights.length; i++) {
    bumpiness += Math.abs(stackHeights[i] - stackHeights[i - 1])
  }

  // Max height (excluding open column)
  const maxHeight = Math.max(...stackHeights, 0)

  // Average height of stacking columns
  const avgHeight = stackHeights.length > 0
    ? stackHeights.reduce((a, b) => a + b, 0) / stackHeights.length
    : 0

  // Filled cells
  let filledCells = 0
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) filledCells++
  }

  return {
    holes,
    bumpiness,
    maxHeight,
    avgHeight,
    filledCells,
    width: w,
    height: h,
    score: state.score,
    linesCleared: state.linesCleared,
    gameOver: state.gameOver,
    openColHeight: heights[openCol],
  }
}

async function waitAndAnalyze(page, minScore, pollInterval, maxWait) {
  return page.evaluate(
    ({ minScore: ms, pollInterval: pi, maxWait: mw, analyzeFnStr }) => {
      // Deserialize the analysis function in the browser context
      const analyze = new Function('state', analyzeFnStr)

      return new Promise((resolve) => {
        const startTime = Date.now()

        const timer = setInterval(() => {
          const state = window.__tetrisState
          if (!state) return

          const elapsed = Date.now() - startTime

          if (state.score >= ms || elapsed >= mw || state.gameOver) {
            clearInterval(timer)
            const result = analyze(state)
            result.elapsed = elapsed
            resolve(result)
          }
        }, pi)
      })
    },
    {
      minScore: minScore,
      pollInterval: pollInterval,
      maxWait: maxWait,
      analyzeFnStr: analyzeBoardInBrowser.toString().replace(/^function[^{]*\{/, '').replace(/\}$/, ''),
    }
  )
}

test.describe('Seeded AI stacking quality', () => {
  for (const { seed, width } of TEST_CASES) {
    test(`seed=${seed} width=${width}: AI stacks cleanly`, async ({ page }) => {
      await page.goto(`/?seed=${seed}&width=${width}`)

      // Wait for WASM solver and game state
      await page.waitForFunction(
        () => window.__tetrisState != null,
        { timeout: 15000 }
      )

      // Verify board width is 3n+1
      const actualWidth = await page.evaluate(() => window.__tetrisState.width)
      expect(actualWidth % 3).toBe(1)

      const result = await waitAndAnalyze(page, MIN_SCORE, POLL_INTERVAL_MS, MAX_WAIT_MS)

      // 1. Board should have meaningful play (not trivially passing)
      expect(result.filledCells).toBeGreaterThan(10)
      expect(result.score).toBeGreaterThan(50)

      // 2. AI must survive — not game over
      expect(result.gameOver).toBe(false)

      // 3. Holes should be minimal relative to board width
      //    A good solver on any width should produce very few holes
      const maxHoles = Math.max(3, Math.floor(result.width / 5))
      expect(result.holes).toBeLessThanOrEqual(maxHoles)

      // 4. Landscape should be relatively flat — bumpiness scales with width
      //    but should stay proportional (avg ~1-2 bump per column pair)
      const stackingCols = result.width - 1 // excluding open column
      const maxBumpiness = stackingCols * 3 // avg 3 height diff per pair is generous
      expect(result.bumpiness).toBeLessThanOrEqual(maxBumpiness)

      // 5. Open column (rightmost) should be mostly clear for Tetris strategy
      //    Allow some height but it should be significantly lower than avg
      expect(result.openColHeight).toBeLessThan(result.maxHeight)

      // 6. Max height shouldn't be dangerously high (below 60% of board)
      const dangerHeight = Math.floor(result.height * 0.6)
      expect(result.maxHeight).toBeLessThan(dangerHeight)
    })
  }
})
