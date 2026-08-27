// CPU-profile the Tetris background via CDP against the preview build.
// Usage: node scripts/profile-game.mjs [speed] [seconds]
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

const speed = process.argv[2] || '1'
if (!/^\d{1,3}$/.test(speed)) {
  console.error('speed must be a 1-3 digit integer')
  process.exit(1)
}
const seconds = Number(process.argv[3] || 15)
const url = process.env.PROFILE_URL || 'http://localhost:4173'
const { hostname } = new URL(url)
if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
  throw new Error(`PROFILE_URL must be loopback, got ${hostname}`)
}

// NixOS: use the nix-provided chromium, not Playwright's dynamically
// linked download
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN || 'chromium',
  args: ['--no-sandbox', '--disable-gpu-vsync'],
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(url)
await page.waitForTimeout(2500) // let WASM load and the game start

if (speed !== '1') {
  // Sidebar holds the speed slider; toggle it open first
  await page.click('.sidebar-toggle-btn')
  await page.locator('.speed-slider').fill(speed)
  // Hide the sidebar again so profiling reflects the plain background
  await page.click('.sidebar-toggle-btn')
}

const cdp = await page.context().newCDPSession(page)
await cdp.send('Profiler.enable')
await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
await cdp.send('Profiler.start')
await page.waitForTimeout(seconds * 1000)
const { profile } = await cdp.send('Profiler.stop')

const out = `/tmp/tetris-${speed}x.cpuprofile`
writeFileSync(out, JSON.stringify(profile))

// Rank by self time
const nodes = new Map(profile.nodes.map((n) => [n.id, n]))
const selfMicros = new Map()
const deltas = profile.timeDeltas || []
const samples = profile.samples || []
for (let i = 0; i < samples.length; i++) {
  selfMicros.set(samples[i], (selfMicros.get(samples[i]) || 0) + (deltas[i] || 0))
}
const totalMicros = deltas.reduce((a, b) => a + b, 0)

const rows = [...selfMicros.entries()]
  .map(([id, micros]) => {
    const n = nodes.get(id)
    const f = n?.callFrame || {}
    const where = `${(f.url || '').split('/').pop()}:${f.lineNumber ?? '?'}`
    return { name: f.functionName || '(anonymous)', where, ms: micros / 1000 }
  })
  .sort((a, b) => b.ms - a.ms)

console.log(`\n=== speed ${speed}x, ${seconds}s wall, ${(totalMicros / 1000).toFixed(0)}ms sampled ===`)
console.log('self-ms  %      function                                   location')
for (const r of rows.slice(0, 25)) {
  const pct = ((r.ms * 1000) / totalMicros * 100).toFixed(1).padStart(5)
  console.log(`${r.ms.toFixed(0).padStart(7)}  ${pct}  ${r.name.slice(0, 40).padEnd(42)} ${r.where}`)
}
console.log(`profile saved: ${out}`)
await browser.close()
