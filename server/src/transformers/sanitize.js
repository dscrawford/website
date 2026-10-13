// Shared string hygiene for untrusted ESPN payloads: control, zero-width
// and bidi-override characters could spoof UI text once rendered
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g

// Logos are rendered as <img src>; only ESPN's own CDN is let through so a
// tampered payload cannot point every visitor's browser elsewhere
const LOGO_HOSTS = new Set(['a.espncdn.com', 'a1.espncdn.com'])

export function safeLogo(url) {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && LOGO_HOSTS.has(u.hostname) ? u.href : null
  } catch {
    return null
  }
}

export function str(value, max = 64) {
  if (typeof value === 'string') return value.replace(CONTROL_CHARS, ' ').trim().slice(0, max)
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}
