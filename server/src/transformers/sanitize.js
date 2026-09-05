// Shared string hygiene for untrusted ESPN payloads: control, zero-width
// and bidi-override characters could spoof UI text once rendered
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g

export function str(value, max = 64) {
  if (typeof value === 'string') return value.replace(CONTROL_CHARS, ' ').trim().slice(0, max)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}
