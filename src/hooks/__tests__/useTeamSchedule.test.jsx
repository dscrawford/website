// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import useTeamSchedule from '../useTeamSchedule.js'

const SCHEDULE = { teamId: '5', team: { abbreviation: 'CLE', name: 'Cleveland Guardians' }, season: '2026', games: [], fetchedAt: 'x' }

function okResponse(data = SCHEDULE) {
  return { ok: true, json: async () => ({ success: true, data, error: null }) }
}

describe('useTeamSchedule', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    delete globalThis.fetch
  })

  it('fetches once on mount and exposes the schedule', async () => {
    globalThis.fetch.mockResolvedValue(okResponse())
    const { result } = renderHook(() => useTeamSchedule('mlb', '5'))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.schedule).toEqual(SCHEDULE))
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/scores/mlb/teams/5/schedule', expect.anything())
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(false)
  })

  it('does nothing until both league and team id are known', () => {
    const { rerender } = renderHook(({ league, team }) => useTeamSchedule(league, team), {
      initialProps: { league: null, team: null },
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    rerender({ league: 'mlb', team: null })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    globalThis.fetch.mockResolvedValue(okResponse())
    rerender({ league: 'mlb', team: '5' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('surfaces HTTP and network failures as error with a retry that refetches', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const { result } = renderHook(() => useTeamSchedule('mlb', '5'))
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.loading).toBe(false)

    globalThis.fetch.mockResolvedValueOnce(okResponse())
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.schedule).toEqual(SCHEDULE))
    expect(result.current.error).toBe(false)
  })

  it('aborts the in-flight request on unmount and ignores its result', async () => {
    let capturedSignal
    globalThis.fetch.mockImplementation((_url, opts) => {
      capturedSignal = opts.signal
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    })
    const { result, unmount } = renderHook(() => useTeamSchedule('mlb', '5'))
    unmount()
    expect(capturedSignal.aborted).toBe(true)
    expect(result.current.error).toBe(false)
  })

  it('refetches when the team changes', async () => {
    globalThis.fetch.mockResolvedValue(okResponse())
    const { rerender } = renderHook(({ team }) => useTeamSchedule('mlb', team), { initialProps: { team: '5' } })
    rerender({ team: '6' })
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))
    expect(globalThis.fetch).toHaveBeenLastCalledWith('/api/scores/mlb/teams/6/schedule', expect.anything())
  })

  it('ignores a superseded request that settles after a newer one', async () => {
    const resolvers = []
    globalThis.fetch = vi.fn(() => new Promise((resolve) => resolvers.push(resolve)))
    const { result, rerender } = renderHook(({ team }) => useTeamSchedule('mlb', team), { initialProps: { team: '5' } })
    rerender({ team: '6' })
    expect(resolvers).toHaveLength(2)

    resolvers[1](okResponse({ ...SCHEDULE, teamId: '6' }))
    await waitFor(() => expect(result.current.schedule?.teamId).toBe('6'))

    resolvers[0](okResponse({ ...SCHEDULE, teamId: '5' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(result.current.schedule?.teamId).toBe('6')
  })
})
