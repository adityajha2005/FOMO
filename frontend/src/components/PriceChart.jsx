import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, createChart, CrosshairMode } from "lightweight-charts";
import { CHART_REFRESH_MS } from "../config/polling.js";
import { LIVE_API_ENABLED } from "../config/api.js";
import { getKlines } from "../services/binanceApi.js";

const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1d" },
];

const RANGE = [
  { label: "1D", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1y" },
];

function generateCandles(count = 120) {
  const candles = [];
  let time = Math.floor(Date.now() / 1000) - count * 3600;
  let price = 0.88;

  for (let i = 0; i < count; i += 1) {
    const volatility = 0.012 + Math.random() * 0.018;
    const open = price;
    const close = open * (1 + (Math.random() - 0.46) * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * 0.006);
    const low = Math.min(open, close) * (1 - Math.random() * 0.006);

    candles.push({ time, open, high, low, close });
    price = close;
    time += 3600;
  }

  return candles;
}

export default function PriceChart({ symbol = "PONS", live = false, price = "$0.922" }) {
  const panelRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [interval, setInterval] = useState("1d");
  const [range, setRange] = useState("1D");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [overlays, setOverlays] = useState({
    swaps: false,
    thesis: true,
    friends: false,
    minSize: true,
  });

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0a0a0b" },
        textColor: "#71717a",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 380,
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80",
      downColor: "#f87171",
      borderUpColor: "#4ade80",
      borderDownColor: "#f87171",
      wickUpColor: "#4ade80",
      wickDownColor: "#f87171",
    });

    seriesRef.current = series;
    series.setData(generateCandles());

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height || 380,
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    function syncFullscreenState() {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(active === panelRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!LIVE_API_ENABLED || !live) {
      return undefined;
    }

    let active = true;

    async function loadCandles() {
      if (!seriesRef.current) {
        return;
      }

      try {
        const candles = await getKlines("BTCUSDT", interval, 120);
        if (active && candles.length > 0) {
          seriesRef.current.setData(candles);
        }
      } catch {
        if (active && seriesRef.current) {
          seriesRef.current.setData(generateCandles());
        }
      }
    }

    loadCandles();
    const intervalId = window.setInterval(loadCandles, CHART_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [symbol, interval, live]);

  function toggleOverlay(key) {
    setOverlays((current) => ({ ...current, [key]: !current[key] }));
  }

  async function toggleFullscreen() {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const active = document.fullscreenElement || document.webkitFullscreenElement;

    try {
      if (active === panel) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      } else if (panel.requestFullscreen) {
        await panel.requestFullscreen();
      } else if (panel.webkitRequestFullscreen) {
        await panel.webkitRequestFullscreen();
      }
    } catch {
      // Browser blocked fullscreen — ignore.
    }
  }

  return (
    <div ref={panelRef} className={`chart-panel${isFullscreen ? " chart-panel--fullscreen" : ""}`}>
      <div className="chart-header">
        <span className="chart-header__label">{symbol}/USD · Market Cap</span>
        <div className="chart-header__actions">
          <span className="chart-header__price num positive">{price}</span>
          <button
            type="button"
            className="chart-fullscreen-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen chart"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen chart"}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="chart-toolbar">
        <div className="chart-toolbar__left">
          {INTERVALS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.value === interval ? "pill active" : "pill"}
              onClick={() => setInterval(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chart-toolbar__right">
          <button type="button" className="pill">
            Indicators
          </button>
        </div>
      </div>

      <div ref={containerRef} className="chart-canvas" />

      <div className="chart-footer">
        <div className="chart-toolbar__left">
          {RANGE.map((item) => (
            <button
              key={item.label}
              type="button"
              className={item.label === range ? "pill active" : "pill"}
              onClick={() => setRange(item.label)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chart-overlays">
          <label className="overlay-check">
            <input type="checkbox" checked={overlays.swaps} onChange={() => toggleOverlay("swaps")} />
            My swaps
          </label>
          <label className="overlay-check">
            <input type="checkbox" checked={overlays.thesis} onChange={() => toggleOverlay("thesis")} />
            Thesis
          </label>
          <label className="overlay-check">
            <input type="checkbox" checked={overlays.friends} onChange={() => toggleOverlay("friends")} />
            Friends only
          </label>
          <label className="overlay-check">
            <input type="checkbox" checked={overlays.minSize} onChange={() => toggleOverlay("minSize")} />
            Min size (&gt;$1K)
          </label>
        </div>
      </div>
    </div>
  );
}
