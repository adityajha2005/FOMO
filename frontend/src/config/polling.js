/** Polling intervals tuned for the free 500 credits/month tier. */
export const LEADERBOARD_REFRESH_MS = 5 * 60 * 1000;
export const TOKEN_REFRESH_MS = 5 * 60 * 1000;
export const TICKER_REFRESH_MS = 60 * 1000;
export const CHART_REFRESH_MS = 3 * 60 * 1000;

/** FOMO API credit costs (approximate per call). */
export const CREDIT_COSTS = {
  leaderboardKeyless: 0,
  alertsKeyless: 0,
  tokenSearch: 1,
  tokenHolders: 1,
  tokenStats: 1,
  tokenTheses: 5,
};
