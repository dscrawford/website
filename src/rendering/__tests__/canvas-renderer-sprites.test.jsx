// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderBoard } from '../canvas-renderer.js'
import { SPRITE_PAD } from '../cell-sprites.js'
import { EMPTY } from '../../game-engine/types.js'

// jsdom has no real canvas: stub createElement('canvas') so sprite baking
// succeeds and the sprite branch (not the fallback) is exercised

function fakeSpriteCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      shadowColor: '',
      shadowBlur: 0,
    }),
  }
}

function mockMainCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 0,
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  }
}

function makeState(width, height) {
  return {
    width,
    height,
    board: new Uint8Array(width * height),
    current: { type: 3, rotation: 0, row: 0, col: 3 },
    ghostRow: height - 2,
    gameOver: false,
  }
}

describe('canvas-renderer sprite branch', () => {
  let createElementSpy

  beforeEach(() => {
    createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(() => fakeSpriteCanvas())
  })

  afterEach(() => {
    createElementSpy.mockRestore()
  })

  it('blits one sprite per placed cell plus current piece cells', () => {
    const state = makeState(10, 20)
    state.board[19 * 10 + 2] = 1
    state.board[19 * 10 + 5] = 7

    const ctx = mockMainCtx()
    renderBoard(ctx, state, 25, 250, 500, 1)

    // 2 placed cells + 4 current-piece cells
    expect(ctx.drawImage).toHaveBeenCalledTimes(6)
  })

  it('positions sprites offset by the bake padding', () => {
    const state = makeState(10, 20)
    state.board[19 * 10 + 2] = 1
    state.current = null

    const ctx = mockMainCtx()
    const cellSize = 25
    renderBoard(ctx, state, cellSize, 250, 500, 1)

    const [, dx, dy, dw, dh] = ctx.drawImage.mock.calls[0]
    expect(dx).toBe(2 * cellSize - SPRITE_PAD)
    expect(dy).toBe(19 * cellSize - SPRITE_PAD)
    expect(dw).toBe(cellSize + SPRITE_PAD * 2)
    expect(dh).toBe(cellSize + SPRITE_PAD * 2)
  })

  it('skips unknown cell values instead of throwing', () => {
    const state = makeState(10, 20)
    state.board[19 * 10 + 2] = 9 // invalid piece type
    state.board[19 * 10 + 4] = 2
    state.current = null

    const ctx = mockMainCtx()
    expect(() => renderBoard(ctx, state, 25, 250, 500, 1)).not.toThrow()
    expect(ctx.drawImage).toHaveBeenCalledTimes(1)
  })

  it('never sets shadowBlur on the main context in the sprite branch', () => {
    const state = makeState(10, 20)
    state.board[19 * 10 + 2] = 1

    const ctx = mockMainCtx()
    ctx.shadowBlur = 0
    renderBoard(ctx, state, 25, 250, 500, 1)
    expect(ctx.shadowBlur).toBe(0)
  })

  it('empty board draws only the current piece', () => {
    const state = makeState(10, 20)
    const ctx = mockMainCtx()
    renderBoard(ctx, state, 25, 250, 500, 1)
    expect(ctx.drawImage).toHaveBeenCalledTimes(4)
  })
})
