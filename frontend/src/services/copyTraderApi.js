import { LIVE_API_ENABLED } from "../config/api.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchCopyTraderSnapshot(limit = 40) {
  if (!LIVE_API_ENABLED) {
    throw new Error("Live API disabled");
  }

  const response = await fetch(`${API_BASE}/api/copy-trader?limit=${limit}`);

  if (!response.ok) {
    throw new Error(`Copy-trader API failed: ${response.status}`);
  }

  return response.json();
}

async function postTrade(path, body) {
  if (!LIVE_API_ENABLED) {
    throw new Error("Live API disabled");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Trade failed: ${response.status}`);
  }

  return payload;
}

export function submitManualBuy({ token, address, usd, chain, networkId }) {
  return postTrade("/api/copy-trader/buy", {
    token,
    address,
    usd,
    chain,
    network_id: networkId,
  });
}

export function submitManualSell({ token, address, positionId, usd }) {
  return postTrade("/api/copy-trader/sell", {
    token,
    address,
    position_id: positionId,
    usd,
  });
}
