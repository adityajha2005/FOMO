/** All API responses cached for 1 hour before revalidation. */
export const CACHE_TTL_MS = 60 * 60 * 1000;

/** Re-fetch interval matches cache TTL — no call before cache expires. */
export const LEADERBOARD_REFRESH_MS = CACHE_TTL_MS;

/** Paid token endpoints — no automatic polling; cache handles revalidation. */
export const TOKEN_REFRESH_MS = null;

export const TICKER_REFRESH_MS = CACHE_TTL_MS;
export const CHART_REFRESH_MS = CACHE_TTL_MS;

export const CACHE_TTL = {
  default: CACHE_TTL_MS,
  leaderboard: CACHE_TTL_MS,
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
