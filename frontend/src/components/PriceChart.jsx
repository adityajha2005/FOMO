import { useEffect, useRef } from "react";
import { CandlestickSeries, createChart, CrosshairMode } from "lightweight-charts";
import { CHART_REFRESH_MS } from "../config/polling.js";
import { getKlines } from "../services/binanceApi.js";

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

export default function PriceChart({ symbol = "PONS", live = false }) {
  const containerRef = useRef(null);
  const seriesRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "#0d0d0d" },
        textColor: "#737373",
      },
      grid: {
        vertLines: { color: "#171717" },
        horzLines: { color: "#171717" },
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
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
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
    let active = true;

    async function loadCandles() {
      if (!seriesRef.current) {
        return;
      }

      try {
        const binanceSymbol = ["BTC", "ETH", "SOL", "BNB"].includes(symbol)
          ? `${symbol}USDT`
          : "BTCUSDT";
        const candles = await getKlines(binanceSymbol, "1h", 120);

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
  }, [symbol]);

  return (
    <div className="chart-panel">
      <div className="chart-toolbar">
        <div className="chart-toolbar__left">
          {["1m", "15m", "1h", "4h", "1D", "1W"].map((item) => (
            <button key={item} type="button" className={item === "1D" ? "pill active" : "pill"}>
              {item}
            </button>
          ))}
        </div>
        <div className="chart-toolbar__right">
          <button type="button" className="pill">{live ? "Live chart" : "Demo chart"}</button>
          <button type="button" className="pill">USD / {symbol}</button>
        </div>
      </div>
      <div ref={containerRef} className="chart-canvas" />
    </div>
  );
}
