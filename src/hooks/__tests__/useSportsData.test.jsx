// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import useSportsData from '../useSportsData.js'

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) }
}

describe('useSportsData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('starts loading with no data or error', () => {
    fetch.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useSportsData())
    expect(result.current.loading).toBe(true)
    expect(result.current.leagues).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('populates leagues on success', async () => {
    fetch.mockResolvedValue(jsonResponse({ success: true, data: { leagues: { nfl: {} } } }))
    const { result } = renderHook(() => useSportsData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.leagues).toEqual({ nfl: {} })
    expect(result.current.error).toBeNull()
    expect(result.current.lastUpdated).toBeInstanceOf(Date)
  })

  it('keeps the previous reference for identical payloads', async () => {
    fetch.mockResolvedValue(jsonResponse({ success: true, data: { leagues: { nfl: { games: [] } } } }))
    const { result } = renderHook(() => useSportsData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const first = result.current.leagues
    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.leagues).toBe(first)
  })

  it.each([
    ['non-OK HTTP', jsonResponse({}, false, 503), 'HTTP 503'],
    ['success false with message', jsonResponse({ success: false, error: 'cache offline' }), 'cache offline'],
    ['success false without message', jsonResponse({ success: false }), 'Unknown error'],
  ])('sets error for %s', async (_label, response, expected) => {
    fetch.mockResolvedValue(response)
    const { result } = renderHook(() => useSportsData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(expected)
  })

  it('sets error on network rejection', async () => {
    fetch.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useSportsData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('network down')
  })

  it('does not set error on abort', async () => {
    const abortErr = new Error('aborted')
    abortErr.name = 'AbortError'
    fetch.mockRejectedValue(abortErr)
    const { result } = renderHook(() => useSportsData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it('refetch() triggers an immediate fetch', async () => {
    fetch.mockResolvedValue(jsonResponse({ success: true, data: { leagues: {} } }))
    const { result } = renderHook(() => useSportsData())
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = fetch.mock.calls.length
    await act(async () => {
      await result.current.refetch()
    })
    expect(fetch.mock.calls.length).toBe(before + 1)
  })

  it('aborts the in-flight request on unmount', async () => {
    let capturedSignal
    fetch.mockImplementation((_url, opts) => {
      capturedSignal = opts.signal
      return new Promise(() => {})
    })
    const { unmount } = renderHook(() => useSportsData())
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    expect(capturedSignal.aborted).toBe(true)
  })

  it('stops polling after unmount', async () => {
    vi.useFakeTimers()
    fetch.mockResolvedValue(jsonResponse({ success: true, data: { leagues: {} } }))
    const { unmount } = renderHook(() => useSportsData())
    await act(async () => {
      await Promise.resolve()
    })
    const callsBefore = fetch.mock.calls.length
    unmount()
    vi.advanceTimersByTime(120_000)
    expect(fetch.mock.calls.length).toBe(callsBefore)
  })
})
