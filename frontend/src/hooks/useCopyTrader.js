import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_API_ENABLED } from "../config/api.js";
import { COPY_TRADER_REFRESH_MS } from "../config/polling.js";
import { fetchCopyTraderSnapshot } from "../services/copyTraderApi.js";

const EMPTY = {
  mode: "paper",
  account_usd: 0,
  stats: null,
  open_positions: [],
  closed_positions: [],
  events: [],
};

export function useCopyTrader({ enabled = LIVE_API_ENABLED, refreshKey = 0 } = {}) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const activeRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    try {
      const snapshot = await fetchCopyTraderSnapshot();
      if (!activeRef.current) {
        return;
      }
      setData(snapshot);
      setConnected(true);
      setError(null);
    } catch (err) {
      if (!activeRef.current) {
        return;
      }
      setConnected(false);
      setError(err.message || "Could not load copy-trader data");
    } finally {
      if (activeRef.current) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;

    if (!enabled) {
      setLoading(false);
      return undefined;
    }

    refresh();
    const intervalId = window.setInterval(refresh, COPY_TRADER_REFRESH_MS);
    return () => {
      activeRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [enabled, refresh, refreshKey]);

  return { data, loading, error, connected, refresh };
}
