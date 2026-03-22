import { describe, it, expect } from 'vitest'
import { calculateBoardDimensions } from '../useDynamicBoardSize.js'

describe('useDynamicBoardSize — calculateBoardDimensions', () => {
  it('calculates cell size from viewport height / board height', () => {
    const { cellSize } = calculateBoardDimensions(1920, 1080, 40)
    expect(cellSize).toBe(Math.floor(1080 / 40)) // 27
  })

  it('calculates width from viewport width / cell size', () => {
    const { width } = calculateBoardDimensions(1920, 1080, 40)
    // cellSize = 27, width = floor(1920/27) = 71
    expect(width).toBe(71)
  })

  it('caps width at 999', () => {
    const { width } = calculateBoardDimensions(100000, 1080, 40)
    expect(width).toBe(999)
  })

  it('enforces minimum width of 10', () => {
    const { width } = calculateBoardDimensions(100, 1080, 40)
    expect(width).toBe(10)
  })

  it('handles 4K resolution', () => {
    const { cellSize, width } = calculateBoardDimensions(3840, 2160, 40)
    expect(cellSize).toBe(54) // floor(2160/40)
    expect(width).toBe(71)    // floor(3840/54)
  })

  it('handles ultrawide resolution', () => {
    const { width } = calculateBoardDimensions(5120, 1440, 40)
    // cellSize = 36, width = floor(5120/36) = 142
    expect(width).toBe(142)
  })

  it('returns height as-is', () => {
    const { height } = calculateBoardDimensions(1920, 1080, 40)
    expect(height).toBe(40)
  })

  it('handles very small viewport', () => {
    const { cellSize, width } = calculateBoardDimensions(320, 480, 40)
    expect(cellSize).toBe(12) // floor(480/40)
    expect(width).toBe(26)    // floor(320/12)
  })

  it('cellSize is always at least 1', () => {
    const { cellSize } = calculateBoardDimensions(10, 10, 40)
    expect(cellSize).toBeGreaterThanOrEqual(1)
  })
})
