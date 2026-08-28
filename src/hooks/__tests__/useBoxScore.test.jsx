// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useBoxScore from '../useBoxScore.js'

const BOX = { gameId: '401', teams: [{ name: 'Reds', groups: [] }], fetchedAt: 'x' }

function okResponse(data = BOX) {
  return { ok: true, json: async () => ({ success: true, data, error: null }) }
}

describe('useBoxScore — live page mode', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete globalThis.fetch
  })

  it('fetches immediately on mount and exposes the box score', async () => {
    globalThis.fetch.mockResolvedValue(okResponse())
    const { result } = renderHook(() => useBoxScore('mlb', '401'))
    await waitFor(() => expect(result.current.boxScore).toEqual(BOX))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/games/401', expect.anything())
    expect(result.current.error).toBe(false)
  })

  it('does nothing until the league is resolved', () => {
    const { rerender } = renderHook(({ league }) => useBoxScore(league, '401'), {
      initialProps: { league: null },
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    globalThis.fetch.mockResolvedValue(okResponse())
    rerender({ league: 'mlb' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('polls on the given interval while mounted and stops on unmount', async () => {
    vi.useFakeTimers()
    globalThis.fetch.mockResolvedValue(okResponse())
    const { unmount } = renderHook(() => useBoxScore('mlb', '401', { intervalMs: 30000 }))
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90000)
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })

  it('keeps the last good box score across a failed poll and sets error', async () => {
    vi.useFakeTimers()
    globalThis.fetch.mockResolvedValueOnce(okResponse())
    const { result } = renderHook(() => useBoxScore('mlb', '401', { intervalMs: 30000 }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.boxScore).toEqual(BOX)

    globalThis.fetch.mockRejectedValueOnce(new Error('down'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(result.current.boxScore).toEqual(BOX)
    expect(result.current.error).toBe(true)
  })

  it('retry() refetches after an error', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useBoxScore('nba', '77'))
    await waitFor(() => expect(result.current.error).toBe(true))
    globalThis.fetch.mockResolvedValue(okResponse())
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.boxScore).toEqual(BOX))
  })

  it('treats non-ok responses as errors', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 500 })
    const { result } = renderHook(() => useBoxScore('nfl', '9'))
    await waitFor(() => expect(result.current.error).toBe(true))
  })
})
