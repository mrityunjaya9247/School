// No shared rate limiter exists in this project (it has no backend at all
// today), so this is a small hand-rolled per-key fixed-window limiter —
// enough to blunt accidental abuse of a locally hosted LLM, not a security
// boundary. Fine for a single-process deploy; swap for a shared store
// (Redis, etc.) if this server is ever run with more than one instance.
'use strict';

function createRateLimiter({ limit = 20, windowMs = 60_000 } = {}) {
  const hits = new Map(); // key -> { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return function allow(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count += 1;
    return true;
  };
}

module.exports = { createRateLimiter };
