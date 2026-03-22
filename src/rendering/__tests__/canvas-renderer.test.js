import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderBoard } from '../canvas-renderer.js'
import { createGame, hardDrop } from '../../game-engine/engine.js'
import { PIECE_COLORS, BOARD_BG, GRID_COLOR } from '../colors.js'
import { PIECE_SHAPES } from '../../game-engine/types.js'

function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    lineWidth: 0,
  }
}

describe('canvas-renderer — renderBoard', () => {
  let ctx

  beforeEach(() => {
    ctx = createMockCtx()
  })

  it('clears the canvas before drawing', () => {
    const state = createGame(10, 20)
    renderBoard(ctx, state, 25, 250, 500)
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 250, 500)
  })

  it('draws background fill', () => {
    const state = createGame(10, 20)
    renderBoard(ctx, state, 25, 250, 500)
    // fillRect should have been called (background + cells)
    expect(ctx.fillRect).toHaveBeenCalled()
  })

  it('draws grid lines', () => {
    const state = createGame(10, 20)
    renderBoard(ctx, state, 25, 250, 500)
    // Should have beginPath + stroke for grid
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('draws placed pieces on the board', () => {
    let state = createGame(10, 20)
    state = hardDrop(state) // place a piece
    renderBoard(ctx, state, 25, 250, 500)
    // Should draw filled rectangles for placed cells
    // fillRect called for: background + placed cells + current piece + ghost
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThan(1)
  })

  it('draws the current (active) piece', () => {
    const state = createGame(10, 20)
    renderBoard(ctx, state, 25, 250, 500)
    // Current piece has 4 cells, so fillRect should be called at least 4 times
    // (background + 4 current cells + 4 ghost cells minimum)
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(5)
  })

  it('draws ghost piece with reduced alpha', () => {
    const state = createGame(10, 20)
    renderBoard(ctx, state, 25, 250, 500)
    // save/restore should be called for ghost piece alpha
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
  })

  it('handles empty board without errors', () => {
    const state = createGame(10, 20)
    expect(() => renderBoard(ctx, state, 25, 250, 500)).not.toThrow()
  })

  it('handles wide boards without errors', () => {
    const state = createGame(200, 40)
    expect(() => renderBoard(ctx, state, 20, 4000, 800)).not.toThrow()
  })
})
