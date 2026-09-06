import { formatPnl, formatUsd, formatPercent } from "../utils/format.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function fomoapiRequest(path, { requireKey = false } = {}) {
  const response = await fetch(`${API_BASE}/api/fomoapi${path}`);
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Request failed: ${response.status}`;
    if (response.status === 401 && requireKey) {
      throw new Error("Add FOMO_API_KEY to frontend/.env for token holders, stats, and realtime data.");
    }
    throw new Error(message);
  }

  if (payload?.error) {
    throw new Error(payload.message || payload.error);
  }

  return payload;
}

function mapTraderEntry(trader) {
  const handle = trader.handle || "unknown";
  const name = trader.displayName || handle;
  const pnlRaw = Number(trader.pnlUsd) || 0;

  return {
    id: handle,
    rank: trader.rank,
    name,
    handle: `@${handle}`,
    pnl: formatPnl(pnlRaw),
    pnlRaw,
    avatarUrl: trader.avatar || null,
    initials: name.slice(0, 1).toUpperCase(),
    clan: trader.clan || null,
  };
}

function mapClanEntry(clan) {
  const name = clan.name || "Unknown";
  const pnlRaw = Number(clan.pnlRaw ?? clan.pnl) || 0;

  return {
    id: clan.id,
    rank: clan.rank,
    name,
    members: clan.members ?? clan.memberCount ?? 0,
    pnl: formatPnl(pnlRaw),
    pnlRaw,
    avatarUrl: clan.avatarUrl || clan.iconLink || clan.icon || null,
    initials: name.slice(0, 2).toUpperCase(),
    handle: `${clan.members ?? clan.memberCount ?? 0} members`,
  };
}

export function aggregateClansFromTraders(traders) {
  const clanMap = new Map();

  for (const trader of traders) {
    if (!trader.clan?.id) {
      continue;
    }

    const existing = clanMap.get(trader.clan.id) || {
      id: trader.clan.id,
      name: trader.clan.name,
      avatarUrl: trader.clan.icon,
      pnlRaw: 0,
      members: 0,
      initials: (trader.clan.name || "?").slice(0, 2).toUpperCase(),
    };

    existing.pnlRaw += trader.pnlRaw || 0;
    existing.members += 1;
    clanMap.set(trader.clan.id, existing);
  }

  return [...clanMap.values()]
    .sort((a, b) => b.pnlRaw - a.pnlRaw)
    .map((clan, index) => mapClanEntry({ ...clan, rank: index + 1 }));
}

export async function getTraderLeaderboard({ window = "7d", limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const payload = await fomoapiRequest(`/v2/leaderboard/${window}?${params}`);
  return (payload.traders ?? []).map(mapTraderEntry);
}

export async function getLeaderboard(options = {}) {
  const traders = await getTraderLeaderboard(options);
  const clans = aggregateClansFromTraders(traders);

  return { traders, clans, source: "fomoapi" };
}

export async function getClanLeaderboard(options = {}) {
  const traders = await getTraderLeaderboard(options);
  return { clans: aggregateClansFromTraders(traders), source: "fomoapi-derived" };
}

export async function getAlerts({ limit = 30 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  const payload = await fomoapiRequest(`/v2/alerts?${params}`);
  return payload.alerts ?? [];
}

export async function searchToken(query) {
  const params = new URLSearchParams({ q: query, limit: "1" });
  const payload = await fomoapiRequest(`/v2/tokens/search?${params}`, { requireKey: true });
  return payload.tokens?.[0] || payload.results?.[0] || null;
}

export async function getTokenHolders(address, { limit = 20, networkId } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (networkId) {
    params.set("networkId", String(networkId));
  }

  const payload = await fomoapiRequest(`/token/${address}/holders?${params}`, { requireKey: true });
  return payload.holders ?? [];
}

export async function getTokenStats(address, { networkId } = {}) {
  const params = networkId ? `?networkId=${networkId}` : "";
  return fomoapiRequest(`/v2/token/${address}/stats${params}`, { requireKey: true });
}

export async function getTokenTheses(address, { limit = 20, networkId } = {}) {
  const params = new URLSearchParams({ limit: String(limit), sort: "likes" });
  if (networkId) {
    params.set("network", networkId === 1399811149 ? "sol" : "robinhood");
  }

  const payload = await fomoapiRequest(`/v2/thesis/token/${address}?${params}`, { requireKey: true });
  return payload.theses ?? payload.items ?? [];
}

export function mapHolderRow(holder, symbol) {
  const amount = Number(holder.amount) || 0;
  const valueUsd = Number(holder.valueUsd) || 0;
  const priceUsd = Number(holder.priceUsd) || (amount ? valueUsd / amount : 0);

  return {
    name: holder.displayName || holder.handle || "Unknown",
    handle: `@${holder.handle || "unknown"}`,
    avatarUrl: holder.avatar || null,
    position: amount.toLocaleString("en-US", { maximumFractionDigits: 2 }),
    pnlPct: holder.pnlPct ? formatPercent(holder.pnlPct) : "—",
    pnlUsd: holder.pnlUsd != null ? formatPnl(holder.pnlUsd) : "—",
    avgEntry: priceUsd ? formatUsd(priceUsd, { decimals: 3 }) : "—",
    thesis: holder.thesis || "—",
  };
}

export function mapThesisRow(thesis) {
  return {
    name: thesis.name || thesis.displayName || thesis.handle || "Unknown",
    handle: `@${thesis.handle || "unknown"}`,
    position: thesis.tradeUsd != null ? formatUsd(thesis.tradeUsd) : "—",
    pnlPct: thesis.likes != null ? `${thesis.likes} likes` : "—",
    pnlUsd: thesis.equity != null ? formatUsd(thesis.equity) : "—",
    avgEntry: "—",
    thesis: thesis.text || "—",
  };
}

export function mapTokenStats(token, stats) {
  const change24h = token?.change24h ?? stats?.change24h;
  const windows = stats?.windows?.["24h"];

  return {
    marketCap: token?.marketCapUsd != null ? formatUsd(token.marketCapUsd, { compact: true }) : "—",
    price: token?.priceUsd != null ? formatUsd(token.priceUsd, { decimals: 3 }) : "—",
    change: change24h != null ? formatPercent(change24h) : "—",
    changePositive: (change24h ?? 0) >= 0,
    volume: token?.volume24hUsd != null
      ? formatUsd(token.volume24hUsd, { compact: true })
      : windows?.buyVolumeUsd != null
        ? formatUsd(windows.buyVolumeUsd + (windows.sellVolumeUsd || 0), { compact: true })
        : "—",
    liquidity: token?.liquidityUsd != null ? formatUsd(token.liquidityUsd, { compact: true }) : "—",
    performance: stats?.windows
      ? {
          "5M": formatPercent(stats.windows["5m"]?.priceChangePercent ?? 0),
          "1H": formatPercent(stats.windows["1h"]?.priceChangePercent ?? 0),
          "4H": formatPercent(stats.windows["4h"]?.priceChangePercent ?? 0),
          "1D": formatPercent(stats.windows["24h"]?.priceChangePercent ?? change24h ?? 0),
        }
      : null,
    sentiment: windows
      ? {
          buys: windows.buys ?? 0,
          sells: windows.sells ?? 0,
        }
      : null,
    holderCount: stats?.holders ?? null,
    address: token?.address || null,
    networkId: token?.networkId || null,
    imageUrl: token?.image || token?.imageUrl || null,
  };
}
