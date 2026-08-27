import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Real jsdom canvas is unavailable (no `canvas` package: getContext returns
// null), so document is stubbed by hand

function makeFakeCanvas() {
  const ctx = {
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
  }
  return { width: 0, height: 0, getContext: vi.fn(() => ctx), __ctx: ctx }
}

describe('cell-sprites — getCellSprites', () => {
  const originalDocument = globalThis.document

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    globalThis.document = originalDocument
  })

  it('returns null when document is unavailable', async () => {
    globalThis.document = undefined
    const { getCellSprites } = await import('../cell-sprites.js')
    expect(getCellSprites(30, 1)).toBeNull()
  })

  it('bakes placed + active sprites per piece type, index 0 unused', async () => {
    const canvases = []
    globalThis.document = {
      createElement: vi.fn(() => {
        const c = makeFakeCanvas()
        canvases.push(c)
        return c
      }),
    }
    const { getCellSprites } = await import('../cell-sprites.js')
    const sprites = getCellSprites(30, 1)
    expect(sprites.placed).toHaveLength(8)
    expect(sprites.active).toHaveLength(8)
    expect(sprites.placed[0]).toBeNull()
    for (let type = 1; type <= 7; type++) {
      expect(sprites.placed[type]).toBeTruthy()
      expect(sprites.active[type]).toBeTruthy()
    }
    expect(canvases).toHaveLength(14)
  })

  it('sizes sprites to (cellSize + 2*SPRITE_PAD) * dpr', async () => {
    globalThis.document = { createElement: vi.fn(() => makeFakeCanvas()) }
    const { getCellSprites, SPRITE_PAD } = await import('../cell-sprites.js')
    const sprites = getCellSprites(24, 2)
    const expected = (24 + SPRITE_PAD * 2) * 2
    expect(sprites.placed[1].width).toBe(expected)
    expect(sprites.placed[1].height).toBe(expected)
  })

  it('active sprites use a wider glow than placed sprites', async () => {
    globalThis.document = { createElement: vi.fn(() => makeFakeCanvas()) }
    const { getCellSprites } = await import('../cell-sprites.js')
    const sprites = getCellSprites(30, 1)
    expect(sprites.placed[1].__ctx.shadowBlur).toBe(6)
    expect(sprites.active[1].__ctx.shadowBlur).toBe(10)
  })

  it('caches on identical (cellSize, dpr) and rebuilds on change', async () => {
    globalThis.document = { createElement: vi.fn(() => makeFakeCanvas()) }
    const { getCellSprites } = await import('../cell-sprites.js')
    const a = getCellSprites(30, 1)
    expect(getCellSprites(30, 1)).toBe(a)
    expect(globalThis.document.createElement).toHaveBeenCalledTimes(14)

    const b = getCellSprites(31, 1)
    expect(b).not.toBe(a)
    const c = getCellSprites(31, 2)
    expect(c).not.toBe(b)
    expect(c.dpr).toBe(2)
  })
})
