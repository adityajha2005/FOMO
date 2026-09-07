import { CACHE_TTL, KNOWN_TOKENS, LEADERBOARD_CACHE_MS, LEADERBOARD_REFRESH_MS } from "../config/polling.js";
import { LIVE_API_ENABLED } from "../config/api.js";
import { clearCache, fetchWithCache } from "../utils/fomoCache.js";
import {
  formatLeaderboardPnl,
  formatPnl,
  formatTokenPrice,
  formatUsd,
  formatPercent,
} from "../utils/format.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function fomoapiRequest(path, { requireKey = false } = {}) {
  if (!LIVE_API_ENABLED) {
    throw new Error("Live API disabled ? UI preview mode");
  }

  const response = await fetch(`${API_BASE}/api/fomoapi${path}`);
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || `Request failed: ${response.status}`;
    if (response.status === 401) {
      throw new Error(
        requireKey
          ? "Add FOMO_API_KEY to frontend/.env (local) or Vercel env vars (production) for token boards, holders, and stats."
          : "Add FOMO_API_KEY to frontend/.env (local) or Vercel env vars (production). Free keys at https://fomoapi.io/dashboard",
      );
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
    pnl: formatLeaderboardPnl(pnlRaw),
    pnlRaw,
    avatarUrl: trader.avatar || trader.profilePictureLink || null,
    initials: name.slice(0, 1).toUpperCase(),
    clan: trader.clan || null,
  };
}

/** Richer row for the landing "book" table: followers, trades, wallet, clan. */
function mapBookEntry(trader, index) {
  const handle = trader.handle || "unknown";
  const name = trader.displayName || handle;
  const pnlRaw = Number(trader.pnlUsd) || 0;
  const wallet = trader.wallets?.solana || trader.wallets?.evm || null;
  const token = trader.topToken || trader.token || trader.primaryToken || null;
  const contract = token?.address || wallet;
  const tickerSymbol = token?.symbol || handle.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  return {
    id: handle,
    rank: trader.rank ?? index + 1,
    name,
    handle,
    ticker: `$${tickerSymbol}`,
    pnlRaw,
    volumeRaw: Number(trader.volumeUsd) || 0,
    trades: Number(trader.trades) || 0,
    followers: Number(trader.followers) || 0,
    holdings: Number(trader.holdings) || 0,
    feesEth: trader.feesEth ?? trader.fees?.eth ?? null,
    mcapEth: trader.mcapEth ?? trader.marketCapEth ?? token?.marketCapEth ?? null,
    contract,
    graduated: Boolean(trader.graduated || token?.graduated),
    avatarUrl: trader.avatar || null,
    initials: name.slice(0, 1).toUpperCase(),
    clan: trader.clan?.name || null,
    wallet,
    walletIsSolana: Boolean(trader.wallets?.solana),
    verified: Boolean(trader.verified),
  };
}

export async function getBookTraders({ window = "24h", limit = 122 } = {}) {
  const cacheKey = `fomo:book:v2:${window}:${limit}`;
  return fetchWithCache(cacheKey, async () => {
    const params = new URLSearchParams({ limit: String(limit) });
    const payload = await fomoapiRequest(`/v2/leaderboard/${window}?${params}`);
    return (payload.traders ?? []).map(mapBookEntry);
  }, LEADERBOARD_CACHE_MS);
}

function formatClanPnl(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? "+" : "-";

  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }

  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }

  return `${sign}$${abs.toFixed(0)}`;
}

function mapClanEntry(clan) {
  const name = clan.name || "Unknown";
  const pnlRaw = Number(clan.pnlRaw ?? clan.pnl) || 0;

  return {
    id: clan.id,
    rank: clan.rank,
    name,
    members: clan.members ?? clan.memberCount ?? 0,
    pnl: formatClanPnl(pnlRaw),
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

export async function getTraderLeaderboard({ window = "7d", limit = 30 } = {}) {
  const cacheKey = `fomo:leaderboard:v3:${window}:${limit}`;
  return fetchWithCache(cacheKey, async () => {
    const params = new URLSearchParams({ limit: String(limit) });
    const payload = await fomoapiRequest(`/v2/leaderboard/${window}?${params}`);
    return (payload.traders ?? []).map(mapTraderEntry);
  }, LEADERBOARD_CACHE_MS);
}

function mapClanFromProdApi(clan) {
  const pnlRaw = Number(clan.pnlUsd ?? clan.pnl ?? clan.totalPnlUsd) || 0;
  const name = clan.name || "Unknown";

  return {
    id: clan.id,
    rank: clan.rank,
    name,
    members: clan.memberCount ?? clan.members ?? clan.numMembers ?? 0,
    pnl: formatClanPnl(pnlRaw),
    pnlRaw,
    avatarUrl: clan.iconLink || clan.icon || clan.avatarUrl || null,
    initials: name.slice(0, 2).toUpperCase(),
    source: "fomo.family",
  };
}

async function fetchProdClanLeaderboard({ window = "24h", limit = 50 } = {}) {
  const params = new URLSearchParams({ window, limit: String(limit) });
  const response = await fetch(`${API_BASE}/api/fomo/v2/clans/leaderboard?${params}`);

  if (response.status === 401 || response.status === 430) {
    return { error: "expired" };
  }

  if (!response.ok) {
    return { error: "unavailable" };
  }

  const payload = await response.json();
  const rows =
    payload.responseObject?.leaderboard ??
    payload.clans ??
    payload.data ??
    payload.results ??
    [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "empty" };
  }

  return {
    clans: rows.map((clan, index) =>
      mapClanFromProdApi({ ...clan, rank: clan.rank ?? index + 1 }),
    ),
  };
}

export async function getClanLeaderboard({ window = "24h", limit = 50 } = {}) {
  const cacheKey = `fomo:clans:v4:${window}:${limit}`;

  return fetchWithCache(cacheKey, async () => {
    // prod-api.fomo.family often blocks server-side requests (430) even with a valid token.
    // fomoapi.io attaches clan on each trader ? aggregate that as the reliable source.
    const traders = await getTraderLeaderboard({ window, limit: 100 });
    const aggregated = aggregateClansFromTraders(traders).slice(0, limit);

    if (aggregated.length > 0) {
      const live = await fetchProdClanLeaderboard({ window, limit });
      if (live?.clans?.length) {
        return { clans: live.clans, source: "fomo.family", tokenError: null };
      }

      return {
        clans: aggregated.map((clan) => ({ ...clan, source: "fomoapi" })),
        source: "fomoapi",
        tokenError: null,
      };
    }

    const live = await fetchProdClanLeaderboard({ window, limit });
    if (live?.clans) {
      return { clans: live.clans, source: "fomo.family", tokenError: null };
    }

    return {
      clans: [],
      source: "unavailable",
      tokenError: live?.error === "expired" ? "expired" : live?.error ?? "missing",
    };
  }, LEADERBOARD_CACHE_MS);
}

export function clearLeaderboardCache() {
  for (const key of ["24h", "7d", "30d", "all"]) {
    clearCache(`fomo:leaderboard:v3:${key}:30`);
    clearCache(`fomo:leaderboard:v3:${key}:100`);
    clearCache(`fomo:clans:v4:${key}:50`);
  }
}

export async function getLeaderboard(options = {}) {
  const window = options.window ?? "24h";
  const limit = options.limit ?? 30;

  const [traders, clanPayload] = await Promise.all([
    getTraderLeaderboard({ window, limit }),
    getClanLeaderboard({ window, limit: 50 }),
  ]);

  return {
    traders,
    clans: clanPayload.clans,
    clanSource: clanPayload.source,
    clanTokenError: clanPayload.tokenError,
    traderSource: "fomoapi",
  };
}

export async function getAlerts({ limit = 30 } = {}) {
  const cacheKey = `fomo:alerts:${limit}`;
  return fetchWithCache(cacheKey, async () => {
    const params = new URLSearchParams({ limit: String(limit) });
    const payload = await fomoapiRequest(`/v2/alerts?${params}`);
    return payload.alerts ?? [];
  }, CACHE_TTL.default);
}

const TOKEN_BOARDS = {
  trending: "trending",
  "most-held": "most-held",
  graduated: "graduated",
};

async function loadTokenBoard(board = "trending", limit = 50) {
  const boardId = TOKEN_BOARDS[board] ? board : "trending";
  const cacheKey = `fomo:token-board:v1:${boardId}:${limit}`;

  return fetchWithCache(cacheKey, async () => {
    const payload = await fomoapiRequest(
      `/v2/leaderboard/tokens/${boardId}?limit=${limit}`,
      { requireKey: true },
    );

    if (payload.available === false) {
      return [];
    }

    return payload.tokens ?? [];
  }, CACHE_TTL.leaderboard);
}

async function loadTrendingTokens() {
  return loadTokenBoard("trending", 50);
}

async function getTrendingTokenByAddress(address) {
  const tokens = await loadTrendingTokens();
  return (
    tokens.find((entry) => {
      const entryAddress = entry.token?.address || entry.address;
      return entryAddress?.toLowerCase() === address.toLowerCase();
    }) ?? null
  );
}

export async function getTrendingTokens() {
  return loadTrendingTokens();
}

export async function getTokenBoard(board = "trending", { limit = 50 } = {}) {
  return loadTokenBoard(board, limit);
}

export async function searchUnified(query, { limit = 8 } = {}) {
  const cacheKey = `fomo:search:${query.toLowerCase()}:${limit}`;
  return fetchWithCache(cacheKey, async () => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const payload = await fomoapiRequest(`/v2/search?${params}`, { requireKey: true });
    return payload.results ?? [];
  }, CACHE_TTL.search);
}

export function mapTrendingToken(entry) {
  const token = entry.token ?? entry;
  const change24h = entry.change24h ?? 0;

  return {
    symbol: token.symbol || "???",
    name: token.name || token.symbol || "Unknown",
    address: token.address || null,
    imageUrl: entry.image || token.image || token.imageUrl || null,
    price: entry.priceUsd != null ? formatTokenPrice(entry.priceUsd) : "?",
    change: formatPercent(change24h),
    changePositive: change24h >= 0,
    marketCap:
      entry.marketCapUsd != null ? `${formatUsd(entry.marketCapUsd, { compact: true })} MC` : "?",
    holders: entry.holders ?? null,
    rank: entry.rank ?? null,
  };
}

function enrichTokenMetadata(token, { marketSnapshot, holderPriceUsd } = {}) {
  return {
    ...token,
    image: marketSnapshot?.image ?? token.image ?? token.imageUrl ?? null,
    priceUsd: marketSnapshot?.priceUsd ?? token.priceUsd ?? holderPriceUsd ?? null,
    marketCapUsd: marketSnapshot?.marketCapUsd ?? token.marketCapUsd ?? null,
    change24h: marketSnapshot?.change24h ?? token.change24h ?? null,
    volume24hUsd: marketSnapshot?.volume24hUsd ?? token.volume24hUsd ?? null,
  };
}

export async function resolveToken(symbol) {
  const known = KNOWN_TOKENS[symbol?.toUpperCase()];
  if (known) {
    return known;
  }

  return searchToken(symbol);
}

export async function searchToken(query) {
  const cacheKey = `fomo:token-search:${query}`;
  return fetchWithCache(cacheKey, async () => {
    const params = new URLSearchParams({ q: query, limit: "1" });
    const payload = await fomoapiRequest(`/v2/tokens/search?${params}`, { requireKey: true });
    return payload.tokens?.[0] || payload.results?.[0] || null;
  }, CACHE_TTL.tokenSearch);
}

export async function getTokenBundle(symbol) {
  const cacheKey = `fomo:token-bundle:v3:${symbol}`;
  return fetchWithCache(cacheKey, async () => {
    const token = await resolveToken(symbol);
    if (!token?.address) {
      throw new Error("Token not found");
    }

    const [holders, stats, marketSnapshot] = await Promise.all([
      fetchTokenHolders(token.address, { limit: 15, networkId: token.networkId }),
      getTokenStats(token.address, { networkId: token.networkId }),
      getTrendingTokenByAddress(token.address),
    ]);

    const holderItems = holders.items ?? [];
    const enrichedToken = enrichTokenMetadata(token, {
      marketSnapshot,
      holderPriceUsd: holderItems[0]?.priceUsd ?? null,
    });

    return {
      token: enrichedToken,
      stats: mapTokenStats(enrichedToken, stats),
      holders: holderItems.map((row) => mapHolderRow(row, symbol)),
      holdersShown: holderItems.length,
      holderTotal: holders.totalHolders ?? stats?.holders ?? null,
    };
  }, CACHE_TTL.tokenData);
}

export async function getTokenThesesCached(symbol, token) {
  const cacheKey = `fomo:thesis:${symbol}`;
  return fetchWithCache(cacheKey, async () => {
    const resolved = token || (await resolveToken(symbol));
    if (!resolved?.address) {
      throw new Error("Token not found");
    }

    const theses = await getTokenTheses(resolved.address, {
      limit: 15,
      networkId: resolved.networkId,
    });

    return theses.map(mapThesisRow);
  }, CACHE_TTL.thesis);
}

async function fetchTokenHolders(address, { limit = 20, networkId } = {}) {
  const cacheKey = `fomo:holders:${address}:${limit}:${networkId ?? "default"}`;
  return fetchWithCache(cacheKey, async () => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (networkId) {
      params.set("networkId", String(networkId));
    }

    const payload = await fomoapiRequest(`/token/${address}/holders?${params}`, { requireKey: true });
    return {
      items: payload.holders ?? [],
      totalHolders: payload.totalHolders ?? payload.count ?? null,
    };
  }, CACHE_TTL.tokenData);
}

export async function getTokenHolders(address, options = {}) {
  const { items } = await fetchTokenHolders(address, options);
  return items;
}

export async function getTokenStats(address, { networkId } = {}) {
  const cacheKey = `fomo:stats:${address}:${networkId ?? "default"}`;
  return fetchWithCache(cacheKey, async () => {
    const params = networkId ? `?networkId=${networkId}` : "";
    return fomoapiRequest(`/v2/token/${address}/stats${params}`, { requireKey: true });
  }, CACHE_TTL.tokenData);
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
    pnlPct: holder.pnlPct ? formatPercent(holder.pnlPct) : "?",
    pnlUsd: holder.pnlUsd != null ? formatPnl(holder.pnlUsd) : "?",
    avgEntry: priceUsd ? formatUsd(priceUsd, { decimals: 3 }) : "?",
    thesis: holder.thesis || "?",
  };
}

export function mapThesisRow(thesis) {
  return {
    name: thesis.name || thesis.displayName || thesis.handle || "Unknown",
    handle: `@${thesis.handle || "unknown"}`,
    position: thesis.tradeUsd != null ? formatUsd(thesis.tradeUsd) : "?",
    pnlPct: thesis.likes != null ? `${thesis.likes} likes` : "?",
    pnlUsd: thesis.equity != null ? formatUsd(thesis.equity) : "?",
    avgEntry: "?",
    thesis: thesis.text || "?",
  };
}

export function mapTokenStats(token, stats) {
  const change24h = token?.change24h ?? stats?.change24h;
  const windows = stats?.windows?.["24h"];
  const hasLiquidity = token?.liquidityUsd != null;

  return {
    marketCap: token?.marketCapUsd != null ? formatUsd(token.marketCapUsd, { compact: true }) : "?",
    price: token?.priceUsd != null ? formatUsd(token.priceUsd, { decimals: 3 }) : "?",
    change: change24h != null ? formatPercent(change24h) : "?",
    changePositive: (change24h ?? 0) >= 0,
    volume: token?.volume24hUsd != null
      ? formatUsd(token.volume24hUsd, { compact: true })
      : windows?.buyVolumeUsd != null
        ? formatUsd(windows.buyVolumeUsd + (windows.sellVolumeUsd || 0), { compact: true })
        : "?",
    liquidity: hasLiquidity ? formatUsd(token.liquidityUsd, { compact: true }) : null,
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
