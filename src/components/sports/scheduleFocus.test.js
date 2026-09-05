import { describe, it, expect } from 'vitest'
import { focusIndex } from './scheduleFocus.js'

const games = (specs) => specs.map(([id, state]) => ({ id, state }))

describe('focusIndex', () => {
  it.each([
    ['current game mid-list', games([['1', 'post'], ['2', 'post'], ['3', 'in'], ['4', 'pre']]), '3', 2],
    ['current game first', games([['1', 'in'], ['2', 'pre']]), '1', 0],
    ['current game last', games([['1', 'post'], ['2', 'post']]), '2', 1],
    ['missing id falls back to the next unplayed game', games([['1', 'post'], ['2', 'post'], ['3', 'pre']]), 'missing', 2],
    ['missing id with the season over falls back to the last row', games([['1', 'post'], ['2', 'post']]), 'missing', 1],
    ['missing id with a single upcoming game', games([['1', 'pre']]), 'missing', 0],
    ['hash-form ids behave like any other miss', games([['1', 'post'], ['2', 'in']]), 'h1a2b3c4', 1],
    ['exact match wins over an earlier unplayed game', games([['1', 'pre'], ['2', 'pre']]), '2', 1],
  ])('%s', (_label, list, currentId, expected) => {
    expect(focusIndex(list, currentId)).toBe(expected)
  })

  it('returns -1 for an empty schedule', () => {
    expect(focusIndex([], '1')).toBe(-1)
    expect(focusIndex([], null)).toBe(-1)
  })
})
