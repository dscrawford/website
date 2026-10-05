import { DATE_PATTERN } from '../config.js'

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
