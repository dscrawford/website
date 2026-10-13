import { useCallback, useEffect, useRef, useState } from 'react'

// One JSON resource from the scores API, fetched once per path. The
// result remembers which path it answers, so `loading` is derived rather
// than flipped in an effect and a stale page never shows under a new one.
export default function useApiData(path) {
  const [result, setResult] = useState({ path: null, data: null, error: false })
  const abortRef = useRef(null)

  const load = useCallback(() => {
    if (!path) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fetch(path, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        // A superseded request may still settle; only the latest one counts
        if (abortRef.current !== controller) return
        setResult({ path, data: body?.data ?? null, error: false })
      })
      .catch((err) => {
        if (err.name === 'AbortError' || abortRef.current !== controller) return
        setResult({ path, data: null, error: true })
      })
  }, [path])

  useEffect(() => {
    if (!path) return undefined
    load()
    return () => abortRef.current?.abort()
  }, [load, path])

  const retry = useCallback(() => {
    setResult({ path: null, data: null, error: false })
    load()
  }, [load])

  const settled = path !== null && result.path === path
  return {
    data: settled ? result.data : null,
    loading: path !== null && !settled,
    error: settled && result.error,
    retry,
  }
}
