import { useCallback, useEffect, useRef, useState } from 'react'

// Live box score for the game page: fetches when the league resolves, then
// polls while mounted. Laziness holds because this only runs while someone
// is actually viewing a game page; the server's TTL cache absorbs the rest.
export default function useBoxScore(leagueKey, gameId, { intervalMs = 30_000 } = {}) {
  const [boxScore, setBoxScore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const abortRef = useRef(null)

  const load = useCallback(() => {
    if (!leagueKey || !gameId) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fetch(`/api/scores/${leagueKey}/games/${gameId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        setBoxScore(body?.data ?? null)
        setError(false)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(true)
        setLoading(false)
      })
  }, [leagueKey, gameId])

  useEffect(() => {
    if (!leagueKey || !gameId) return undefined
    load()
    const timer = setInterval(load, intervalMs)
    return () => {
      clearInterval(timer)
      abortRef.current?.abort()
    }
  }, [load, intervalMs, leagueKey, gameId])

  const retry = useCallback(() => {
    setLoading(true)
    setError(false)
    load()
  }, [load])

  return { boxScore, loading, error, retry }
}
