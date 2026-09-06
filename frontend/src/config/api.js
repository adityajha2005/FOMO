/**
 * Live data is on when VITE_LIVE_API=true in .env (local dev).
 * Production builds (e.g. Vercel) default to live unless VITE_LIVE_API=false.
 */
const liveFlag = import.meta.env.VITE_LIVE_API;
export const LIVE_API_ENABLED =
  liveFlag === "true" || (import.meta.env.PROD && liveFlag !== "false");
