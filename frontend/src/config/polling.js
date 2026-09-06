/** All API responses cached for 1 hour before revalidation. */
export const CACHE_TTL_MS = 60 * 60 * 1000;

/** Paid token endpoints — no automatic polling; cache handles revalidation. */
export const TOKEN_REFRESH_MS = null;

export const TICKER_REFRESH_MS = CACHE_TTL_MS;
export const CHART_REFRESH_MS = CACHE_TTL_MS;

/** Live copy-trader feed — short poll, not cached. */
export const COPY_TRADER_REFRESH_MS = 5000;

/** Leaderboard/clans refresh often — PnL moves in real time. */
export const LEADERBOARD_CACHE_MS = 60 * 1000;
export const LEADERBOARD_REFRESH_MS = LEADERBOARD_CACHE_MS;

export const CACHE_TTL = {
  default: CACHE_TTL_MS,
  leaderboard: LEADERBOARD_CACHE_MS,
  tokenSearch: CACHE_TTL_MS,
  tokenData: CACHE_TTL_MS,
  thesis: CACHE_TTL_MS,
  binance: CACHE_TTL_MS,
  bot: CACHE_TTL_MS,
  search: CACHE_TTL_MS,
};

/** Skip the 1-credit search call for tokens we already know. */
export const KNOWN_TOKENS = {
  PONS: {
    symbol: "PONS",
    name: "Pons",
    address: "0x39dbed3a2bd333467115de45665cc57f813c4571",
    networkId: 4663,
  },
};

export const CREDIT_COSTS = {
  leaderboardKeyless: 0,
  alertsWebSocket: 0,
  tokenSearch: 1,
  tokenHolders: 1,
  tokenStats: 1,
  tokenTheses: 5,
};
