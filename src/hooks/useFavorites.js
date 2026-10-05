import { useCallback, useEffect, useState } from 'react'

// Favorite teams live in a cookie (not localStorage) so the preference
// travels with the visitor's cookie jar and is trivial to clear.
export const FAVORITES_COOKIE = 'favTeams'
export const MAX_FAVORITES = 20
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60

const LEAGUE_KEY = /^[a-z]{2,8}$/
const TEAM_ID = /^\d{1,10}$/
const ABBREVIATION = /^[A-Za-z0-9&.\- ]{1,8}$/

// Strip C0/C1 control characters before trusting anything from the cookie
function isControl(ch) {
  const code = ch.charCodeAt(0)
  return code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

function clean(value, max) {
  if (typeof value !== 'string') return ''
  return Array.from(value).filter((ch) => !isControl(ch)).join('').trim().slice(0, max)
}

// The cookie is client-writable, so every field is re-validated on read
function normalize(entry) {
  if (!entry || typeof entry !== 'object') return null
  const league = clean(entry.league, 8)
  const id = clean(entry.id, 10)
  const abbreviation = clean(entry.abbreviation, 8)
  const name = clean(entry.name, 64)
  if (!LEAGUE_KEY.test(league) || !TEAM_ID.test(id) || !ABBREVIATION.test(abbreviation) || !name) return null
  return Object.freeze({ league, id, abbreviation, name })
}

function readCookie(name) {
  const prefix = `${name}=`
  const found = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

export function readFavorites() {
  const raw = readCookie(FAVORITES_COOKIE)
  if (!raw) return []
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalize).filter(Boolean).slice(0, MAX_FAVORITES)
  } catch {
    return []
  }
}

function writeFavorites(list) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  const value = encodeURIComponent(JSON.stringify(list))
  document.cookie = `${FAVORITES_COOKIE}=${value}; max-age=${MAX_AGE_SECONDS}; path=/; SameSite=Lax${secure}`
}

const same = (a, b) => a.league === b.league && a.id === b.id

// Every mounted hook sees a toggle from any other (star on a card, the
// favorites strip, the team page) without a page reload
const listeners = new Set()

export default function useFavorites() {
  const [favorites, setFavorites] = useState(readFavorites)

  useEffect(() => {
    listeners.add(setFavorites)
    return () => listeners.delete(setFavorites)
  }, [])

  const isFavorite = useCallback(
    (league, id) => favorites.some((f) => same(f, { league, id })),
    [favorites]
  )

  const toggle = useCallback((team) => {
    const entry = normalize(team)
    if (!entry) return
    const now = readFavorites()
    const next = now.some((f) => same(f, entry))
      ? now.filter((f) => !same(f, entry))
      : [entry, ...now].slice(0, MAX_FAVORITES)
    writeFavorites(next)
    for (const notify of listeners) notify(next)
  }, [])

  return { favorites, isFavorite, toggle }
}
