import { useEffect, useMemo, useRef, useState } from "react";
import { LIVE_API_ENABLED } from "../config/api.js";
import { COPY_TRADER_REFRESH_MS } from "../config/polling.js";
import { fetchCopyTraderSnapshot } from "../services/copyTraderApi.js";
import { getBookTraders } from "../services/fomoApi.js";

const FALLBACK_EARNERS = [
  { handle: "damsizdayl", pnlRaw: 1 },
  { handle: "zeri_terminal", pnlRaw: 0.85 },
  { handle: "ogtoalbus", pnlRaw: 0.72 },
  { handle: "dreamloaderxo", pnlRaw: 0.61 },
  { handle: "mrfernando88", pnlRaw: 0.55 },
  { handle: "ericnoar", pnlRaw: 0.48 },
  { handle: "unipcs", pnlRaw: 0.42 },
];

function parseBuyUsd(text) {
  const match = String(text || "").match(/\$(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function buildVolumeSeries(events = [], points = 24) {
  const buys = events
    .filter((event) => event.kind === "buy")
    .map((event) => ({ ts: Number(event.ts) || 0, usd: parseBuyUsd(event.text) }))
    .filter((row) => row.usd > 0)
    .sort((a, b) => a.ts - b.ts);

  if (buys.length === 0) {
    return Array.from({ length: points }, (_, index) => {
      const t = index / (points - 1);
      return 0.15 + t * 0.75 + Math.sin(t * Math.PI * 2) * 0.04;
    });
  }

  let total = 0;
  const cumulative = buys.map((row) => {
    total += row.usd;
    return { ts: row.ts, total };
  });

  const maxTotal = cumulative[cumulative.length - 1].total || 1;
  const start = cumulative[0].ts;
  const end = cumulative[cumulative.length - 1].ts || start + 1;

  return Array.from({ length: points }, (_, index) => {
    const target = start + ((end - start) * index) / (points - 1);
    let value = 0;
    for (const row of cumulative) {
      if (row.ts <= target) {
        value = row.total;
      }
    }
    return value / maxTotal;
  });
}

function buildRoiSeries(history, currentRoi, points = 24) {
  if (history.length >= 2) {
    const values = history.map((row) => row.roi);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return values.map((value) => 0.08 + ((value - min) / span) * 0.84);
  }

  const base = Number(currentRoi) || 0;
  return Array.from({ length: points }, (_, index) => {
    const t = index / (points - 1);
    const wave = Math.sin(t * Math.PI * 1.4) * 0.06;
    const trend = t * 0.72;
    const normalized = Math.max(0.05, Math.min(0.95, 0.18 + trend + wave + base / 100));
    return normalized;
  });
}

function seriesToPath(values, width, height) {
  if (!values.length) {
    return `M 0 ${height} L ${width} ${height}`;
  }

  const step = width / Math.max(values.length - 1, 1);
  const coords = values.map((value, index) => {
    const x = index * step;
    const y = height - value * height;
    return [x, y];
  });

  return coords.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

export function useDashboardTerminal(windowId = "24h") {
  const [bot, setBot] = useState({
    mode: "paper",
    account_usd: 1000,
    stats: null,
    open_positions: [],
    closed_positions: [],
    events: [],
  });
  const [book, setBook] = useState([]);
  const [loading, setLoading] = useState(LIVE_API_ENABLED);
  const [connected, setConnected] = useState(false);
  const [roiHistory, setRoiHistory] = useState([]);
  const roiHistoryRef = useRef([]);

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      setBook(FALLBACK_EARNERS);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);

    getBookTraders({ window: windowId, limit: 30 })
      .then((rows) => {
        if (active) {
          setBook(rows.length ? rows : FALLBACK_EARNERS);
        }
      })
      .catch(() => {
        if (active) {
          setBook(FALLBACK_EARNERS);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [windowId]);

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      return undefined;
    }

    let active = true;

    async function refresh() {
      try {
        const snapshot = await fetchCopyTraderSnapshot();
        if (!active) {
          return;
        }
        setBot(snapshot);
        setConnected(!snapshot.dev_stub);
        if (snapshot.stats?.roi_pct != null) {
          const point = {
            ts: snapshot.updated_at || Date.now() / 1000,
            roi: snapshot.stats.roi_pct,
          };
          roiHistoryRef.current = [...roiHistoryRef.current.slice(-47), point];
          setRoiHistory([...roiHistoryRef.current]);
        }
      } catch {
        if (active) {
          setConnected(false);
        }
      }
    }

    refresh();
    const id = window.setInterval(refresh, COPY_TRADER_REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const stats = bot.stats;
  const roiPct = stats?.roi_pct ?? 10.15;
  const roiDelta =
    stats?.day_pnl != null && bot.account_usd
      ? (stats.day_pnl / bot.account_usd) * 100
      : 1.6;

  const earners = useMemo(() => {
    const rows = book.length ? book : FALLBACK_EARNERS;
    return rows.slice(0, 7).map((row, index) => ({
      ...row,
      handle: (row.handle || "").replace(/^@/, ""),
      rank: index + 1,
      pnlRaw: row.pnlRaw ?? 0,
    }));
  }, [book]);

  const topTraders = useMemo(() => {
    const rows = book.length ? book : FALLBACK_EARNERS;
    return rows.slice(0, 30).map((row, index) => ({
      ...row,
      handle: (row.handle || "").replace(/^@/, ""),
      rank: index + 1,
      pnlRaw: row.pnlRaw ?? 0,
    }));
  }, [book]);

  const maxEarnerPnl = Math.max(...earners.map((row) => row.pnlRaw), 1);
  const walletCount = book.length || 135;
  const walletDelta = connected ? Math.min(4, Math.max(0, earners.length - 6)) : 4;

  const copiedVolumeUsd = useMemo(() => {
    const fromPositions = [...(bot.open_positions || []), ...(bot.closed_positions || [])].reduce(
      (sum, row) => sum + (Number(row.usd_in) || 0),
      0,
    );
    const fromEvents = (bot.events || [])
      .filter((event) => event.kind === "buy")
      .reduce((sum, event) => sum + parseBuyUsd(event.text), 0);
    return fromPositions || fromEvents || 59_800;
  }, [bot]);

  const volumeDelta = stats?.day_pnl != null && copiedVolumeUsd
    ? Math.min(25, Math.max(-5, (stats.day_pnl / copiedVolumeUsd) * 100))
    : 10.7;

  const roiValues = useMemo(
    () => buildRoiSeries(roiHistory, roiPct),
    [roiHistory, roiPct],
  );
  const volumeValues = useMemo(() => buildVolumeSeries(bot.events), [bot.events]);

  const roiPath = seriesToPath(roiValues, 340, 96);
  const volumePath = seriesToPath(volumeValues, 900, 120);

  return {
    bot,
    stats,
    earners,
    topTraders,
    maxEarnerPnl,
    walletCount,
    walletDelta,
    roiPct,
    roiDelta,
    copiedVolumeUsd,
    volumeDelta,
    roiPath,
    volumePath,
    roiValues,
    volumeValues,
    loading,
    connected,
    openPositions: bot.open_positions || [],
    closedPositions: bot.closed_positions || [],
    events: bot.events || [],
    mode: bot.mode || "paper",
    accountUsd: bot.account_usd || 1000,
  };
}
