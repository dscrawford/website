import { describe, it, expect } from 'vitest'
import {
  calculateScore,
  calculateLevel,
  getDropInterval,
  createScoring,
  addLineClears,
  addSoftDrop,
  addHardDrop,
} from '../scoring.js'

describe('scoring — calculateScore', () => {
  it('awards 100 points for 1 line at level 0', () => {
    expect(calculateScore(1, 0)).toBe(100)
  })

  it('awards 300 points for 2 lines at level 0', () => {
    expect(calculateScore(2, 0)).toBe(300)
  })

  it('awards 500 points for 3 lines at level 0', () => {
    expect(calculateScore(3, 0)).toBe(500)
  })

  it('awards 800 points for 4 lines (tetris) at level 0', () => {
    expect(calculateScore(4, 0)).toBe(800)
  })

  it('scales with level (level multiplier is level + 1)', () => {
    expect(calculateScore(1, 9)).toBe(1000)  // 100 * (9+1)
    expect(calculateScore(4, 9)).toBe(8000)  // 800 * (9+1)
  })

  it('returns 0 for 0 lines', () => {
    expect(calculateScore(0, 5)).toBe(0)
  })
})

describe('scoring — calculateLevel', () => {
  it('starts at level 0 with 0 lines', () => {
    expect(calculateLevel(0)).toBe(0)
  })

  it('advances to level 1 after 10 lines', () => {
    expect(calculateLevel(10)).toBe(1)
  })

  it('advances to level 5 after 50 lines', () => {
    expect(calculateLevel(50)).toBe(5)
  })

  it('caps at level 29', () => {
    expect(calculateLevel(300)).toBe(29)
  })
})

describe('scoring — getDropInterval', () => {
  it('returns 800ms at level 0', () => {
    expect(getDropInterval(0)).toBe(800)
  })

  it('gets faster at higher levels', () => {
    const fast = getDropInterval(10)
    const slow = getDropInterval(0)
    expect(fast).toBeLessThan(slow)
  })

  it('has a minimum interval (never reaches 0)', () => {
    const fastest = getDropInterval(29)
    expect(fastest).toBeGreaterThan(0)
  })
})

describe('scoring — state management', () => {
  it('createScoring returns initial state', () => {
    const state = createScoring()
    expect(state.score).toBe(0)
    expect(state.level).toBe(0)
    expect(state.linesCleared).toBe(0)
  })

  it('addLineClears updates score, lines, and level', () => {
    const state = createScoring()
    const updated = addLineClears(state, 4)
    expect(updated.score).toBe(800) // tetris at level 0
    expect(updated.linesCleared).toBe(4)
    expect(updated.level).toBe(0) // not enough for level 1
  })

  it('addLineClears accumulates across calls', () => {
    let state = createScoring()
    state = addLineClears(state, 4)  // 800 points
    state = addLineClears(state, 4)  // 800 points (still level 0)
    state = addLineClears(state, 4)  // now 12 lines → level 1, score at level 1 = 800*2=1600
    expect(state.linesCleared).toBe(12)
    expect(state.level).toBe(1)
  })

  it('addSoftDrop adds 1 point per cell', () => {
    const state = createScoring()
    const updated = addSoftDrop(state, 5)
    expect(updated.score).toBe(5)
  })

  it('addHardDrop adds 2 points per cell', () => {
    const state = createScoring()
    const updated = addHardDrop(state, 10)
    expect(updated.score).toBe(20)
  })

  it('does not mutate original state', () => {
    const state = createScoring()
    addLineClears(state, 4)
    expect(state.score).toBe(0)
  })
})
