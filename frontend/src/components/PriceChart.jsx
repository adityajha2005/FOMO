import { useEffect, useRef, useState } from "react";
import { CandlestickSeries, createChart, CrosshairMode } from "lightweight-charts";
import { CHART_REFRESH_MS } from "../config/polling.js";
import { LIVE_API_ENABLED } from "../config/api.js";
import { getKlines } from "../services/binanceApi.js";
import { binanceSymbolUrl, openExternal } from "../utils/links.js";

const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

function generateCandles(count = 120) {
  const candles = [];
  let time = Math.floor(Date.now() / 1000) - count * 3600;
  let price = 0.82;

  for (let i = 0; i < count; i += 1) {
    const volatility = 0.015 + Math.random() * 0.02;
    const open = price;
    const close = open * (1 + (Math.random() - 0.48) * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);

    candles.push({ time, open, high, low, close });
    price = close;
    time += 3600;
  }

  return candles;
}

function resolveBinanceSymbol(symbol, quoteMode) {
  if (quoteMode === "btc") {
    return "BTCUSDT";
  }

  const majors = ["BTC", "ETH", "SOL", "BNB", "DASH", "ADA", "ATOM", "XRP", "DOGE", "LTC"];
  if (majors.includes(symbol)) {
    return `${symbol}USDT`;
  }

  return "BTCUSDT";
}

export default function PriceChart({ symbol = "PONS", live = false }) {
  const containerRef = useRef(null);
  const seriesRef = useRef(null);
  const chartRef = useRef(null);
  const [interval, setInterval] = useState("1d");
  const [quoteMode, setQuoteMode] = useState("usd");

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0f1216" },
        textColor: "#848e9c",
      },
      grid: {
        vertLines: { color: "#1e2329" },
        horzLines: { color: "#1e2329" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#222222",
      },
      timeScale: {
        borderColor: "#222222",
        timeVisible: true,
      },
      width: containerRef.current.clientWidth,
      height: 360,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderUpColor: "#0ecb81",
      borderDownColor: "#f6465d",
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    series.setData(generateCandles());

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        chart.applyOptions({ width: entry.contentRect.width });
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
    if (!LIVE_API_ENABLED) {
      return undefined;
    }

    let active = true;

    async function loadCandles() {
      if (!seriesRef.current) {
        return;
      }

      const binanceSymbol = resolveBinanceSymbol(symbol, quoteMode);

      try {
        const candles = await getKlines(binanceSymbol, interval, 120);

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
  }, [symbol, interval, quoteMode]);

  const chartPair = resolveBinanceSymbol(symbol, quoteMode).replace("USDT", "");

  return (
    <div className="chart-panel">
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
          <button
            type="button"
            className="pill pill--ghost"
            onClick={() => openExternal(binanceSymbolUrl(chartPair))}
          >
            {live ? "Market data" : "Reference chart"}
          </button>
          <button
            type="button"
            className="pill"
            onClick={() => setQuoteMode((current) => (current === "usd" ? "btc" : "usd"))}
          >
            {quoteMode === "usd" ? `${symbol}/USDT` : "BTC/USDT"}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="chart-canvas" />
    </div>
  );
}
