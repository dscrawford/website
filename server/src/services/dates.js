import { DATE_PATTERN, SEASON_PATTERN, MIN_SEASON } from '../config.js'

// A real calendar day in ISO form; the pattern alone would accept Feb 30
export function isValidDate(date) {
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

// Days already over are immutable; today and the future keep the live TTL
export function isPastDate(date) {
  return date < new Date().toISOString().slice(0, 10)
}

// A season year worth asking ESPN about
export function isValidSeason(season) {
  if (typeof season !== 'string' || !SEASON_PATTERN.test(season)) return false
  const year = Number(season)
  return year >= MIN_SEASON && year <= new Date().getFullYear() + 1
}

// Seasons before the current calendar year are over and never change
export function isPastSeason(season) {
  return Number(season) < new Date().getFullYear()
}
