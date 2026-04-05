import { useState, useEffect, useCallback } from 'react'

export default function useRoute() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((path) => {
    if (path !== window.location.pathname) {
      window.history.pushState(null, '', path)
      setPathname(path)
    }
  }, [])

  return { pathname, navigate }
}
