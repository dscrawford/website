// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useBoxScore from '../useBoxScore.js'

const BOX = { gameId: '401', teams: [{ name: 'Reds', groups: [] }], fetchedAt: 'x' }

function okResponse(data = BOX) {
  return { ok: true, json: async () => ({ success: true, data, error: null }) }
}

describe('useBoxScore', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    delete globalThis.fetch
  })

  it('does not fetch until ensureLoaded is called (lazy)', () => {
    renderHook(() => useBoxScore('mlb', '401'))
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('fetches on ensureLoaded and exposes the box score', async () => {
    globalThis.fetch.mockResolvedValue(okResponse())
    const { result } = renderHook(() => useBoxScore('mlb', '401'))
    act(() => result.current.ensureLoaded())
    await waitFor(() => expect(result.current.boxScore).toEqual(BOX))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/games/401', expect.anything())
    expect(result.current.error).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('ensureLoaded is idempotent — one fetch across repeated opens', async () => {
    globalThis.fetch.mockResolvedValue(okResponse())
    const { result } = renderHook(() => useBoxScore('mlb', '401'))
    act(() => result.current.ensureLoaded())
    await waitFor(() => expect(result.current.boxScore).toEqual(BOX))
    act(() => result.current.ensureLoaded())
    act(() => result.current.ensureLoaded())
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('reports errors and allows retry()', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useBoxScore('nba', '77'))
    act(() => result.current.ensureLoaded())
    await waitFor(() => expect(result.current.error).toBe(true))

    globalThis.fetch.mockResolvedValue(okResponse())
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.boxScore).toEqual(BOX))
    expect(result.current.error).toBe(false)
  })

  it('treats non-ok responses as errors', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500 })
    const { result } = renderHook(() => useBoxScore('nfl', '9'))
    act(() => result.current.ensureLoaded())
    await waitFor(() => expect(result.current.error).toBe(true))
  })

  it('ignores missing league or game id', () => {
    const { result } = renderHook(() => useBoxScore('mlb', undefined))
    act(() => result.current.ensureLoaded())
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
