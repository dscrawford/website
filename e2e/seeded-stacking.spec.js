import { test, expect } from '@playwright/test'

// The board is sized from the viewport (cell = floor(vh / 40), cols =
// clamp(floor(vw / cell), 10, 999)), so every screen shape hands the solver a
// different board: a phone plays ~18x40, a widescreen ~71x40. This spec runs
// the real WASM solver at max speed on each of those shapes and checks it
// stacks cleanly and survives — narrow boards used to bury themselves in holes
// and top out within a hundred pieces.

const RUN_MS = 15000
const SAMPLE_MS = 250

const VIEWPORTS = [
  { label: 'phone portrait (small)', width: 375, height: 667, expectedCols: 23 },
  { label: 'phone portrait', width: 390, height: 844, expectedCols: 18 },
  { label: 'phone landscape', width: 844, height: 390, expectedCols: 93 },
  { label: 'tablet portrait', width: 820, height: 1180, expectedCols: 28 },
  { label: 'laptop', width: 1366, height: 768, expectedCols: 71 },
  { label: 'widescreen', width: 1920, height: 1080, expectedCols: 71 },
  { label: 'ultrawide', width: 3440, height: 1440, expectedCols: 95 },
]

// Runs in the browser: samples the live board and reduces it to stacking
// quality numbers.
function sampleBoard(state) {
  const board = state.board
  const w = state.width
  const h = state.height

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

  let holes = 0
  for (let col = 0; col < w; col++) {
    let covered = false
    for (let row = 0; row < h; row++) {
      if (board[row * w + col] !== 0) covered = true
      else if (covered) holes++
    }
  }

  // The well column is deliberately kept empty, so it is excluded from
  // flatness just as the solver excludes it.
  const wellCol = heights.indexOf(Math.min(...heights))
  const stackHeights = heights.filter((_, i) => i !== wellCol)
  let bumpiness = 0
  for (let i = 1; i < stackHeights.length; i++) {
    bumpiness += Math.abs(stackHeights[i] - stackHeights[i - 1])
  }

  return {
    width: w,
    height: h,
    holes,
    bumpinessPerColumn: stackHeights.length > 1 ? bumpiness / (stackHeights.length - 1) : 0,
    maxHeight: Math.max(...stackHeights, 0),
    score: state.score,
    linesCleared: state.linesCleared,
    gameOver: state.gameOver,
  }
}

async function setMaxSpeed(page) {
  await page.click('.sidebar-toggle-btn')
  await page.locator('.speed-slider').fill('20')
}

async function playAndMeasure(page, runMs, sampleMs, sampleFnStr) {
  return page.evaluate(
    ({ runMs: rm, sampleMs: sm, sampleFnStr: fn }) => {
      const sample = new Function('state', fn)
      return new Promise((resolve) => {
        const start = Date.now()
        let gameOvers = 0
        let maxHoles = 0
        let holesSum = 0
        let samples = 0
        let maxBumpiness = 0
        let maxHeight = 0
        let last = null
        const timer = setInterval(() => {
          const state = window.__tetrisState
          if (state) {
            const s = sample(state)
            if (s.gameOver) gameOvers++
            maxHoles = Math.max(maxHoles, s.holes)
            holesSum += s.holes
            samples++
            maxBumpiness = Math.max(maxBumpiness, s.bumpinessPerColumn)
            maxHeight = Math.max(maxHeight, s.maxHeight)
            last = s
          }
          if (Date.now() - start >= rm) {
            clearInterval(timer)
            resolve({
              ...last,
              gameOvers,
              maxHoles,
              meanHoles: samples > 0 ? holesSum / samples : 0,
              maxBumpinessPerColumn: maxBumpiness,
              maxHeight,
              samples,
            })
          }
        }, sm)
      })
    },
    { runMs, sampleMs, sampleFnStr: sampleFnStr }
  )
}

test.describe('AI stacking quality across screen sizes', () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label} (${viewport.width}x${viewport.height}): AI stacks cleanly`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/')
      await page.waitForFunction(() => window.__tetrisState != null, { timeout: 15000 })
      // Let the WASM solver load before measuring
      await page.waitForTimeout(2000)
      await setMaxSpeed(page)

      const fnBody = sampleBoard
        .toString()
        .replace(/^function[^{]*\{/, '')
        .replace(/\}$/, '')
      const result = await playAndMeasure(page, RUN_MS, SAMPLE_MS, fnBody)

      console.log(
        `${viewport.label}: ${result.width}x${result.height} score=${result.score} ` +
        `meanHoles=${result.meanHoles.toFixed(1)} maxHoles=${result.maxHoles} ` +
        `bump/col=${result.maxBumpinessPerColumn.toFixed(2)} maxH=${result.maxHeight} ` +
        `gameOvers=${result.gameOvers}`
      )

      // The board shape this viewport produces
      expect(result.width, 'board columns').toBe(viewport.expectedCols)
      expect(result.samples).toBeGreaterThan(10)

      // The AI is actually playing
      expect(result.score).toBeGreaterThan(0)

      // It never dies: the auto-solver restarts on game over, so any game
      // over at all shows up here
      expect(result.gameOvers, 'game overs').toBe(0)

      // Holes it digs back out are fine; holes it lives with are not. The
      // narrow-board regression sat on 100+ holes continuously.
      expect(result.meanHoles, 'mean holes').toBeLessThanOrEqual(Math.max(4, result.width / 10))
      expect(result.maxHoles, 'peak holes').toBeLessThanOrEqual(Math.max(16, result.width / 2))

      // Flat landscape, measured as average height difference per column pair
      expect(result.maxBumpinessPerColumn, 'bumpiness per column').toBeLessThanOrEqual(5)

      // Never fills the spawn row — that is an instant game over
      expect(result.maxHeight, 'tallest column').toBeLessThan(result.height)
    })
  }
})
