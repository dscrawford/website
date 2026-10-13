// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useApiData from '../useApiData.js'

const DATA = { league: 'nfl', groups: [] }
const okResponse = (data = DATA) => ({ ok: true, json: async () => ({ success: true, data, error: null }) })

describe('useApiData', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    delete globalThis.fetch
  })

  it('fetches the path once and exposes its data', async () => {
    globalThis.fetch.mockResolvedValue(okResponse())
    const { result } = renderHook(() => useApiData('/api/scores/nfl/standings'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toEqual(DATA))
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/nfl/standings', expect.anything())
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('stays idle without a path', () => {
    const { result } = renderHook(() => useApiData(null))
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('surfaces failures as error with a retry that refetches', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const { result } = renderHook(() => useApiData('/api/x'))
    await waitFor(() => expect(result.current.error).toBe(true))
    globalThis.fetch.mockResolvedValueOnce(okResponse())
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.data).toEqual(DATA))
    expect(result.current.error).toBe(false)
  })

  it('reports loading, not stale data, while a new path is in flight', async () => {
    globalThis.fetch.mockResolvedValue(okResponse())
    const { result, rerender } = renderHook(({ path }) => useApiData(path), { initialProps: { path: '/api/a' } })
    await waitFor(() => expect(result.current.data).toEqual(DATA))
    let release
    globalThis.fetch.mockReturnValueOnce(new Promise((r) => { release = r }))
    rerender({ path: '/api/b' })
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    await act(async () => {
      release(okResponse({ b: 1 }))
    })
    await waitFor(() => expect(result.current.data).toEqual({ b: 1 }))
  })
})
