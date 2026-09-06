import { CACHE_TTL_MS } from "../config/polling.js";

const invalidationTimers = new Map();
const inflightRequests = new Map();

export function readCache(key, ttlMs = CACHE_TTL_MS) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw);
    if (!entry?.savedAt || Date.now() - entry.savedAt > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

export function writeCache(key, data, ttlMs = CACHE_TTL_MS) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));

    const existingTimer = invalidationTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    invalidationTimers.set(
      key,
      setTimeout(() => {
        clearCache(key);
        invalidationTimers.delete(key);
      }, ttlMs),
    );
  } catch {
    // Ignore quota errors.
  }
}

export function clearCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore.
  }

  const timer = invalidationTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    invalidationTimers.delete(key);
  }
}

/**
 * Fetch with a 1h cache. Returns cached data when fresh; otherwise fetches once
 * and stores the result. Duplicate in-flight requests for the same key are merged.
 */
export async function fetchWithCache(key, fetcher, ttlMs = CACHE_TTL_MS) {
  const cached = readCache(key, ttlMs);
  if (cached !== null) {
    return cached;
  }

  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const request = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      writeCache(key, data, ttlMs);
      inflightRequests.delete(key);
      return data;
    })
    .catch((error) => {
      inflightRequests.delete(key);
      throw error;
    });

  inflightRequests.set(key, request);
  return request;
}
