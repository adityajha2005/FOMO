const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request(path) {
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

export const api = {
  getCurrentCoin: () => request("/api/current_coin"),
  getCoins: () => request("/api/coins"),
  getPairs: () => request("/api/pairs"),
  getTradeHistory: (period = "all") => request(`/api/trade_history?period=${period}`),
  getTotalValueHistory: (period = "1d") => request(`/api/total_value_history?period=${period}`),
  getScoutingHistory: (period = "1d") => request(`/api/scouting_history?period=${period}`),
};
