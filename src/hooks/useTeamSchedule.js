import { useCallback, useEffect, useRef, useState } from 'react'

// Season schedule for one team on the game page. Fetched once per
// (league, team): results change at most once a day, so no polling.
export default function useTeamSchedule(leagueKey, teamId) {
  const [schedule, setSchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const abortRef = useRef(null)

  const load = useCallback(() => {
    if (!leagueKey || !teamId) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fetch(`/api/scores/${leagueKey}/teams/${teamId}/schedule`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        // A superseded request may still settle; only the latest one counts
        if (abortRef.current !== controller) return
        setSchedule(body?.data ?? null)
        setError(false)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === 'AbortError' || abortRef.current !== controller) return
        setError(true)
        setLoading(false)
      })
  }, [leagueKey, teamId])

  useEffect(() => {
    if (!leagueKey || !teamId) return undefined
    load()
    return () => abortRef.current?.abort()
  }, [load, leagueKey, teamId])

  const retry = useCallback(() => {
    setLoading(true)
    setError(false)
    load()
  }, [load])

  return { schedule, loading, error, retry }
}
