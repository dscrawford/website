// Concurrent cache misses for one key share a single upstream request
// instead of stampeding ESPN
const inflight = new Map()

export function dedupe(key, run) {
  if (inflight.has(key)) return inflight.get(key)
  const pending = Promise.resolve()
    .then(run)
    .finally(() => inflight.delete(key))
  inflight.set(key, pending)
  return pending
}
