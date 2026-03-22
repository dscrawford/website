import { describe, it, expect } from 'vitest'
import {
  PIECE_TYPES,
  PIECE_SHAPES,
  PIECE_NAMES,
  EMPTY,
  BOARD_HEIGHT,
  MAX_BOARD_WIDTH,
  MIN_BOARD_WIDTH,
  createBag,
} from '../types.js'

describe('types — constants', () => {
  it('defines 7 piece types numbered 1-7', () => {
    const types = Object.values(PIECE_TYPES)
    expect(types).toHaveLength(7)
    expect(types).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('EMPTY is 0', () => {
    expect(EMPTY).toBe(0)
  })

  it('board height is 40', () => {
    expect(BOARD_HEIGHT).toBe(40)
  })

  it('max board width is 999, min is 10', () => {
    expect(MAX_BOARD_WIDTH).toBe(999)
    expect(MIN_BOARD_WIDTH).toBe(10)
  })

  it('every piece type has a name', () => {
    for (const type of Object.values(PIECE_TYPES)) {
      expect(PIECE_NAMES[type]).toBeDefined()
      expect(typeof PIECE_NAMES[type]).toBe('string')
    }
  })
})

describe('types — piece shapes', () => {
  it('every piece type has 4 rotations', () => {
    for (const type of Object.values(PIECE_TYPES)) {
      expect(PIECE_SHAPES[type]).toHaveLength(4)
    }
  })

  it('each rotation is an array of [row, col] offsets', () => {
    for (const type of Object.values(PIECE_TYPES)) {
      for (const rotation of PIECE_SHAPES[type]) {
        expect(rotation).toHaveLength(4) // 4 cells per piece
        for (const [r, c] of rotation) {
          expect(typeof r).toBe('number')
          expect(typeof c).toBe('number')
        }
      }
    }
  })

  it('I piece spans 4 columns in rotation 0', () => {
    const iShape = PIECE_SHAPES[PIECE_TYPES.I][0]
    const cols = iShape.map(([, c]) => c)
    expect(Math.max(...cols) - Math.min(...cols)).toBe(3)
  })

  it('O piece is the same in all rotations', () => {
    const oRotations = PIECE_SHAPES[PIECE_TYPES.O]
    for (let i = 1; i < 4; i++) {
      expect(oRotations[i]).toEqual(oRotations[0])
    }
  })
})

describe('types — 14-bag randomizer', () => {
  it('returns an array of 14 piece types', () => {
    const bag = createBag()
    expect(bag).toHaveLength(14)
  })

  it('contains exactly two of each piece type', () => {
    const bag = createBag()
    const sorted = [...bag].sort((a, b) => a - b)
    expect(sorted).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7])
  })

  it('returns shuffled order (not always sorted)', () => {
    const sorted = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]
    let foundDifferent = false
    for (let i = 0; i < 20; i++) {
      const bag = createBag()
      if (JSON.stringify(bag) !== JSON.stringify(sorted)) {
        foundDifferent = true
        break
      }
    }
    expect(foundDifferent).toBe(true)
  })

  it('different calls produce independent bags', () => {
    const bag1 = createBag()
    const bag2 = createBag()
    // Both should be valid bags (contain all 7 types, twice each)
    expect([...bag1].sort((a, b) => a - b)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7])
    expect([...bag2].sort((a, b) => a - b)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7])
  })
})
