import { test, expect } from '@playwright/test'

// Regression guard for the historical high-speed bug: gravity ticks pushed
// freshly-spawned pieces down before the solver acted, ending games almost
// immediately. In animated mode pieces are soft-dropped rapidly on purpose,
// so observed rows say nothing — the reliable symptoms are piece throughput
// and score progression.

async function setMaxSpeed(page) {
  await page.click('.sidebar-toggle-btn')
  await page.locator('.speed-slider').fill('20')
}

test.describe('High speed integrity', () => {
  test('pieces keep flowing at max slider speed', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => window.__tetrisState != null, { timeout: 10000 })
    // Wait for the WASM solver to come up before measuring
    await page.waitForTimeout(2000)
    await setMaxSpeed(page)

    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const seen = new Set()
        let gameOvers = 0
        const start = Date.now()
        const interval = setInterval(() => {
          const state = window.__tetrisState
          if (state?.current) {
            seen.add(`${state.current.type}:${state.score}:${state.current.col}`)
          }
          if (state?.gameOver) gameOvers++
          if (Date.now() - start > 8000) {
            clearInterval(interval)
            resolve({ distinctPieces: seen.size, gameOvers })
          }
        }, 50)
      })
    })

    // At 20x a piece locks every few hundred ms at most
    expect(result.distinctPieces).toBeGreaterThan(10)
    // The auto-solver restarts on game over; more than a couple of restarts
    // in 8s means pieces are dying on spawn
    expect(result.gameOvers).toBeLessThan(3)
  })

  test('score progresses at max slider speed', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => window.__tetrisState != null, { timeout: 10000 })
    await page.waitForTimeout(2000)
    await setMaxSpeed(page)

    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        let maxScore = 0
        const start = Date.now()
        const interval = setInterval(() => {
          const state = window.__tetrisState
          if (state) maxScore = Math.max(maxScore, state.score)
          if (Date.now() - start > 8000) {
            clearInterval(interval)
            resolve({ maxScore })
          }
        }, 250)
      })
    })

    // Soft-drop points alone accumulate fast at 20x; a premature-death loop
    // would keep resetting the score near zero
    expect(result.maxScore).toBeGreaterThan(500)
  })
})
