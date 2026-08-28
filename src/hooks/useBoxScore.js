import { useCallback, useEffect, useRef, useState } from 'react'

// Box scores are fetched lazily: nothing happens until ensureLoaded() fires
// (first expand), and the result is kept for the component's lifetime — the
// server caches with a short TTL, so a refresh is how numbers update
export default function useBoxScore(leagueKey, gameId) {
  const [boxScore, setBoxScore] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const requestedRef = useRef(false)
  const controllerRef = useRef(null)

  const load = useCallback(() => {
    if (!leagueKey || !gameId) return
    requestedRef.current = true
    setLoading(true)
    setError(false)
    const controller = new AbortController()
    controllerRef.current = controller
    fetch(`/api/scores/${leagueKey}/games/${gameId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        setBoxScore(body?.data ?? null)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(true)
        setLoading(false)
      })
  }, [leagueKey, gameId])

  useEffect(() => () => controllerRef.current?.abort(), [])

  const ensureLoaded = useCallback(() => {
    if (requestedRef.current) return
    load()
  }, [load])

  const retry = useCallback(() => {
    load()
  }, [load])

  return { boxScore, loading, error, ensureLoaded, retry }
}
