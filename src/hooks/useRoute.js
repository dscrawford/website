import { useState, useEffect, useCallback } from 'react'

function current() {
  return { pathname: window.location.pathname, search: window.location.search }
}

export default function useRoute() {
  const [route, setRoute] = useState(current)

  useEffect(() => {
    const handlePopState = () => setRoute(current())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // `path` may carry a query string (/sports?date=2026-09-04)
  const navigate = useCallback((path) => {
    if (path !== window.location.pathname + window.location.search) {
      window.history.pushState(null, '', path)
      setRoute(current())
    }
  }, [])

  return { pathname: route.pathname, search: route.search, navigate }
}
