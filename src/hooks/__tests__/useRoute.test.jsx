// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useRoute from '../useRoute.js'

function setPath(path) {
  window.history.pushState(null, '', path)
}

describe('useRoute', () => {
  beforeEach(() => {
    setPath('/')
  })

  it('initializes pathname from window.location', () => {
    setPath('/sports')
    const { result } = renderHook(() => useRoute())
    expect(result.current.pathname).toBe('/sports')
  })

  it('navigate() updates pathname and pushes history', () => {
    const { result } = renderHook(() => useRoute())
    act(() => result.current.navigate('/sports'))
    expect(result.current.pathname).toBe('/sports')
    expect(window.location.pathname).toBe('/sports')
  })

  it('responds to popstate (browser back/forward)', () => {
    const { result } = renderHook(() => useRoute())
    act(() => result.current.navigate('/sports'))
    act(() => {
      setPath('/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.pathname).toBe('/')
  })

  it('removes the popstate listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useRoute())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function))
    removeSpy.mockRestore()
  })
})
