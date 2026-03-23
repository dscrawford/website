import { test, expect } from '@playwright/test'

// Reproduce: at 999x speed, pieces spawn progressively lower instead of at row 0.
// The game ends prematurely because gravity ticks push freshly-spawned pieces
// down before the solver can act.

test.describe('High speed spawn integrity', () => {
  test('pieces always spawn at row 0 at 999x speed', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => window.__tetrisState != null, { timeout: 10000 })

    // Set speed to 999x via the speed input
    const speedInput = page.locator('.speed-input')
    await speedInput.click()
    await speedInput.fill('999')
    await speedInput.press('Enter')

    // Let the game run at 999x for a few seconds, monitoring every piece spawn
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const spawns = []
        let lastKey = null
        let sampleCount = 0
        const maxSamples = 2000
        const startTime = Date.now()
        const maxDuration = 10000

        const interval = setInterval(() => {
          const state = window.__tetrisState
          if (!state || !state.current) {
            sampleCount++
            if (sampleCount >= maxSamples || (Date.now() - startTime) >= maxDuration) {
              clearInterval(interval)
              resolve({ spawns, gameOver: state?.gameOver ?? false })
            }
            return
          }

          // Detect new piece by a composite key that changes on spawn.
          // After lock, nextQueue shifts and score/lines may change.
          const key = `${state.current.type}-${state.nextQueue?.[0]}-${state.score}-${state.linesCleared}`
          if (key !== lastKey) {
            lastKey = key
            spawns.push({
              row: state.current.row,
              type: state.current.type,
              gameOver: state.gameOver,
            })
          }

          sampleCount++
          if (sampleCount >= maxSamples || (Date.now() - startTime) >= maxDuration) {
            clearInterval(interval)
            resolve({ spawns, gameOver: state.gameOver })
          }
        }, 2)

        setTimeout(() => {
          clearInterval(interval)
          const state = window.__tetrisState
          resolve({ spawns, gameOver: state?.gameOver ?? false })
        }, maxDuration + 1000)
      })
    })

    // Every observed "new piece" should be at row 0-2 (0 ideally, 1-2 for
    // timing tolerance). Row > 3 means gravity pushed it down before the
    // solver could act.
    const badSpawns = result.spawns.filter(s => !s.gameOver && s.row > 3)

    // Log for debugging
    if (badSpawns.length > 0) {
      console.log(`Bad spawns: ${badSpawns.length} / ${result.spawns.length}`)
      console.log('First 5 bad spawns:', badSpawns.slice(0, 5))
    }

    // Should have observed at least some piece spawns (at 999x, most pieces
    // are processed within a single frame so polling can't catch every one)
    expect(result.spawns.length).toBeGreaterThan(2)

    // No spawns should be far from the top
    expect(badSpawns.length).toBe(0)
  })

  test('game does not end prematurely at 999x speed', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => window.__tetrisState != null, { timeout: 10000 })

    // Set speed to 999x
    const speedInput = page.locator('.speed-input')
    await speedInput.click()
    await speedInput.fill('999')
    await speedInput.press('Enter')

    // Let it run for 8 seconds at 999x speed
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const state = window.__tetrisState
          resolve({
            score: state?.score ?? 0,
            linesCleared: state?.linesCleared ?? 0,
            gameOver: state?.gameOver ?? true,
            level: state?.level ?? 0,
          })
        }, 8000)
      })
    })

    // At 999x, the AI should survive and accumulate significant score
    // A premature death due to spawn-row drift would show low score
    expect(result.score).toBeGreaterThan(1000)
    expect(result.linesCleared).toBeGreaterThan(10)
    // Game should not have ended (or if it auto-restarted, score should be high)
  })
})
