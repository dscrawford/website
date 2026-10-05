import { useCallback, useEffect, useRef, useState } from 'react'

// Season schedule for one team. Fetched once per (league, team, season):
// results change at most once a day, so no polling. No season means the
// current one.
//
// The result remembers which request it answers, so `loading` is derived
// (result is for another key) rather than flipped in an effect, and a
// stale season's games never show under a new season's heading.
export default function useTeamSchedule(leagueKey, teamId, season) {
  const key = leagueKey && teamId ? `${leagueKey}/${teamId}/${season ?? ''}` : null
  const [result, setResult] = useState({ key: null, schedule: null, error: false })
  const abortRef = useRef(null)

  const load = useCallback(() => {
    if (!key) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const query = season ? `?season=${encodeURIComponent(season)}` : ''
    fetch(`/api/scores/${leagueKey}/teams/${teamId}/schedule${query}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        // A superseded request may still settle; only the latest one counts
        if (abortRef.current !== controller) return
        setResult({ key, schedule: body?.data ?? null, error: false })
      })
      .catch((err) => {
        if (err.name === 'AbortError' || abortRef.current !== controller) return
        setResult({ key, schedule: null, error: true })
      })
  }, [key, leagueKey, teamId, season])

  useEffect(() => {
    if (!key) return undefined
    load()
    return () => abortRef.current?.abort()
  }, [load, key])

  const retry = useCallback(() => {
    setResult({ key: null, schedule: null, error: false })
    load()
  }, [load])

  const settled = key !== null && result.key === key
  return {
    schedule: settled ? result.schedule : null,
    loading: key !== null && !settled,
    error: settled && result.error,
    retry,
  }
}
