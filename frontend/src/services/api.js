import { LIVE_API_ENABLED } from "../config/api.js";
import { CACHE_TTL } from "../config/polling.js";
import { fetchWithCache } from "../utils/fomoCache.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request(path) {
  if (!LIVE_API_ENABLED) {
    throw new Error("Live API disabled");
  }

  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function cachedRequest(path) {
  const cacheKey = `bot:${path}`;
  return fetchWithCache(cacheKey, () => request(path), CACHE_TTL.bot);
}

export const api = {
  getCurrentCoin: () => cachedRequest("/api/current_coin"),
  getCoins: () => cachedRequest("/api/coins"),
  getPairs: () => cachedRequest("/api/pairs"),
  getTradeHistory: (period = "all") => cachedRequest(`/api/trade_history?period=${period}`),
  getTotalValueHistory: (period = "1d") => cachedRequest(`/api/total_value_history?period=${period}`),
  getScoutingHistory: (period = "1d") => cachedRequest(`/api/scouting_history?period=${period}`),
};
