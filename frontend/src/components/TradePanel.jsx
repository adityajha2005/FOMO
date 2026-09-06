import { useState } from "react";
import {
  binanceTradeUrl,
  fomoTokenUrl,
  openExternal,
  xSearchUrl,
} from "../utils/links.js";

export default function TradePanel({
  symbol = "PONS",
  fomoSymbol = "PONS",
  side,
  onSideChange,
  tokenStats = null,
  aboutText = null,
  botOnline = false,
}) {
  const [amount, setAmount] = useState("0.00");

  const performance = tokenStats?.performance || {
    "5M": "—",
    "1H": "—",
    "4H": "—",
    "1D": tokenStats?.change || "—",
  };

  const buys = tokenStats?.sentiment?.buys ?? 0;
  const sells = tokenStats?.sentiment?.sells ?? 0;
  const total = buys + sells || 1;
  const buyPct = Math.round((buys / total) * 100);
  const sellPct = 100 - buyPct;

  function setQuickAmount(value) {
    setAmount(Number(value).toFixed(2));
  }

  function handleTrade() {
    openExternal(fomoTokenUrl(fomoSymbol));
  }

  function handleBotExecution() {
    openExternal(binanceTradeUrl(symbol));
  }

  return (
    <aside className="trade-panel">
      <div className="panel-heading">
        <h3>Order entry</h3>
        <span className="status-chip">{fomoSymbol}/USD</span>
      </div>

      <div className="trade-toggle">
        <button
          type="button"
          className={side === "buy" ? "trade-toggle__btn buy active" : "trade-toggle__btn buy"}
          onClick={() => onSideChange("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          className={side === "sell" ? "trade-toggle__btn sell active" : "trade-toggle__btn sell"}
          onClick={() => onSideChange("sell")}
        >
          Sell
        </button>
      </div>

      <label className="field-label">Notional (USD)</label>
      <div className="amount-input">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          className="num"
        />
        <span>USD</span>
      </div>

      <div className="quick-amounts">
        {[10, 100, 500, 1000].map((value) => (
          <button key={value} type="button" className="quick-amounts__btn num" onClick={() => setQuickAmount(value)}>
            ${value}
          </button>
        ))}
      </div>

      <button type="button" className={`action-btn ${side}`} onClick={handleTrade}>
        {side === "buy" ? `Buy ${fomoSymbol}` : `Sell ${fomoSymbol}`}
      </button>

      {botOnline && symbol !== fomoSymbol ? (
        <button type="button" className="secondary-btn" onClick={handleBotExecution}>
          Bot execution: {symbol} on Binance
        </button>
      ) : null}

      <section className="about-panel">
        <div className="panel-heading">
          <h4>Market overview</h4>
        </div>
        <p>
          {aboutText ||
            "Social trading terminal connected to live FOMO market data. Execution routes to the official FOMO platform."}
        </p>

        <div className="perf-grid">
          {Object.entries(performance).map(([label, value]) => (
            <div key={label} className="perf-grid__item">
              <span>{label}</span>
              <strong className={`num ${String(value).startsWith("+") ? "positive" : String(value).startsWith("-") ? "negative" : ""}`}>
                {value}
              </strong>
            </div>
          ))}
        </div>

        <div className="sentiment-block">
          <div className="sentiment-row">
            <span>Buy volume (24h)</span>
            <strong className="num">{buys.toLocaleString()}</strong>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__buy" style={{ width: `${buyPct}%` }} />
          </div>
          <div className="sentiment-row">
            <span>Sell volume (24h)</span>
            <strong className="num">{sells.toLocaleString()}</strong>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__sell" style={{ width: `${sellPct}%` }} />
          </div>
        </div>

        <div className="social-links">
          <a className="social-links__btn" href={fomoTokenUrl(fomoSymbol)} target="_blank" rel="noreferrer">
            Token page
          </a>
          <a className="social-links__btn" href={xSearchUrl(`$${fomoSymbol}`)} target="_blank" rel="noreferrer">
            X feed
          </a>
          <a className="social-links__btn" href={xSearchUrl(fomoSymbol)} target="_blank" rel="noreferrer">
            Search
          </a>
        </div>
      </section>
    </aside>
  );
}
