/**
 * Set VITE_LIVE_API=true in frontend/.env when ready to wire live data back in.
 * While false, the app uses mock data only — zero network calls to FOMO/Binance/bot APIs.
 */
export const LIVE_API_ENABLED = import.meta.env.VITE_LIVE_API === "true";
