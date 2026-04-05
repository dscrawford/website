import { useState, useEffect, useRef, useCallback } from 'react'

const POLL_INTERVAL_MS = 15_000

export default function useSportsData() {
  const [leagues, setLeagues] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const abortRef = useRef(null)

  const fetchScores = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/scores', { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Unknown error')

      setLeagues(json.data.leagues)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScores()
    const timer = setInterval(fetchScores, POLL_INTERVAL_MS)

    return () => {
      clearInterval(timer)
      abortRef.current?.abort()
    }
  }, [fetchScores])

  return { leagues, loading, error, lastUpdated }
}
