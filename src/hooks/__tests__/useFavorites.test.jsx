// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useFavorites, { readFavorites, FAVORITES_COOKIE, MAX_FAVORITES } from '../useFavorites.js'

const CLE = { league: 'mlb', id: '5', abbreviation: 'CLE', name: 'Cleveland Guardians' }
const DET = { league: 'mlb', id: '6', abbreviation: 'DET', name: 'Detroit Tigers' }

function clearCookie() {
  document.cookie = `${FAVORITES_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

describe('useFavorites', () => {
  beforeEach(clearCookie)

  it('starts empty when there is no cookie', () => {
    const { result } = renderHook(() => useFavorites())
    expect(result.current.favorites).toEqual([])
    expect(result.current.isFavorite('mlb', '5')).toBe(false)
  })

  it('toggle adds then removes a team and persists to the cookie', () => {
    const { result } = renderHook(() => useFavorites())
    act(() => result.current.toggle(CLE))
    expect(result.current.isFavorite('mlb', '5')).toBe(true)
    expect(readFavorites()).toEqual([CLE])
    expect(document.cookie).toContain(`${FAVORITES_COOKIE}=`)

    act(() => result.current.toggle(CLE))
    expect(result.current.favorites).toEqual([])
    expect(readFavorites()).toEqual([])
  })

  it('reads favorites back from the cookie on a fresh mount, newest first', () => {
    const first = renderHook(() => useFavorites())
    act(() => first.result.current.toggle(CLE))
    act(() => first.result.current.toggle(DET))
    first.unmount()

    const { result } = renderHook(() => useFavorites())
    expect(result.current.favorites.map((f) => f.abbreviation)).toEqual(['DET', 'CLE'])
  })

  it('keys teams by league and id, so the same id in two leagues is two teams', () => {
    const { result } = renderHook(() => useFavorites())
    act(() => result.current.toggle(CLE))
    act(() => result.current.toggle({ ...CLE, league: 'nba' }))
    expect(result.current.favorites).toHaveLength(2)
    expect(result.current.isFavorite('nba', '5')).toBe(true)
  })

  it('ignores a corrupt or hostile cookie', () => {
    document.cookie = `${FAVORITES_COOKIE}=${encodeURIComponent('not json')}; path=/`
    expect(readFavorites()).toEqual([])
    document.cookie = `${FAVORITES_COOKIE}=${encodeURIComponent(JSON.stringify([{ league: 'mlb', id: 'DROP TABLE', abbreviation: '<b>x</b>', name: 'x' }, 7, null]))}; path=/`
    expect(readFavorites()).toEqual([])
    document.cookie = `${FAVORITES_COOKIE}=${encodeURIComponent(JSON.stringify([{ league: 'mlb', id: '5', abbreviation: 'CLE', name: 'x'.repeat(500) }]))}; path=/`
    expect(readFavorites()[0].name.length).toBeLessThanOrEqual(64)
  })

  it('caps the list so the cookie stays small', () => {
    const { result } = renderHook(() => useFavorites())
    for (let i = 0; i < MAX_FAVORITES + 5; i++) {
      act(() => result.current.toggle({ league: 'cbb', id: String(i), abbreviation: `T${i}`, name: `Team ${i}` }))
    }
    expect(result.current.favorites).toHaveLength(MAX_FAVORITES)
    expect(result.current.favorites[0].id).toBe(String(MAX_FAVORITES + 4))
  })
})
