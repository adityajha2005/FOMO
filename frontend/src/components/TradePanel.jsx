import { useMemo, useState } from "react";
import CopyTraderCli from "./CopyTraderCli.jsx";
import { submitManualBuy, submitManualSell } from "../services/copyTraderApi.js";
import { KNOWN_TOKENS } from "../config/polling.js";
import { formatAlertTime, formatPnl, formatUsd } from "../utils/format.js";
import { fomoTokenUrl, xSearchUrl } from "../utils/links.js";

const CHAIN_BY_NETWORK = {
  1399811149: "solana",
  1: "ethereum",
  56: "bsc",
  8453: "base",
  4663: "robinhood",
  143: "monad",
};

function resolveTokenMeta(fomoSymbol, tokenStats) {
  const known = KNOWN_TOKENS[fomoSymbol];
  return {
    address: tokenStats?.address || known?.address || null,
    networkId: tokenStats?.networkId || known?.networkId || null,
    chain: CHAIN_BY_NETWORK[tokenStats?.networkId || known?.networkId] || known?.chain || null,
  };
}

export default function TradePanel({
  symbol = "PONS",
  fomoSymbol = "PONS",
  side,
  onSideChange,
  tokenStats = null,
}) {
  const [amount, setAmount] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tokenMeta = useMemo(() => resolveTokenMeta(fomoSymbol, tokenStats), [fomoSymbol, tokenStats]);
  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount >= 10;

  const performance = tokenStats?.performance || {
    "5M": "—",
    "1H": "—",
    "4H": "—",
    "1D": tokenStats?.change || "—",
  };

  const buys = tokenStats?.sentiment?.buys ?? 2427;
  const sells = tokenStats?.sentiment?.sells ?? 3727;
  const buyers = tokenStats?.sentiment?.buyers ?? 1528;
  const sellers = tokenStats?.sentiment?.sellers ?? 1806;
  const buyVol = tokenStats?.sentiment?.buyVol ?? 60;
  const sellVol = tokenStats?.sentiment?.sellVol ?? 40;

  const tradeTotal = buys + sells || 1;
  const buyerTotal = buyers + sellers || 1;
  const buyPct = Math.round((buys / tradeTotal) * 100);
  const buyerPct = Math.round((buyers / buyerTotal) * 100);

  function setQuickAmount(value) {
    setAmount(String(value));
    setError(null);
  }

  async function handleTrade() {
    if (!tokenMeta.address) {
      setError("Token address not loaded yet.");
      return;
    }
    if (!amountValid) {
      setError("Enter at least $10.");
      return;
    }

    setBusy(true);
    setError(null);
    setReceipt(null);

    try {
      const payload =
        side === "buy"
          ? await submitManualBuy({
              token: fomoSymbol,
              address: tokenMeta.address,
              usd: parsedAmount,
              chain: tokenMeta.chain,
              networkId: tokenMeta.networkId,
            })
          : await submitManualSell({
              token: fomoSymbol,
              address: tokenMeta.address,
              usd: parsedAmount,
            });

      setReceipt(payload.receipt);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="trade-panel">
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

      <div className="amount-input-wrap">
        <div className="amount-input">
          <span className="amount-input__symbol">$</span>
          <input
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
            inputMode="decimal"
            className="num"
            placeholder="0"
          />
        </div>
        <span className="amount-input__hint">
          {side === "buy" ? "Paper buy — simulated at live price" : "Sell open position for this token"}
        </span>
      </div>

      <div className="quick-amounts">
        {[10, 20, 100, 500].map((value) => (
          <button key={value} type="button" className="quick-amounts__btn num" onClick={() => setQuickAmount(value)}>
            ${value}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`action-btn ${side}`}
        onClick={handleTrade}
        disabled={busy || !amountValid}
      >
        {busy ? "Processing…" : side === "buy" ? `Buy ${fomoSymbol}` : `Sell ${fomoSymbol}`}
      </button>

      {error ? <div className="trade-receipt trade-receipt--error">{error}</div> : null}

      {receipt ? (
        <div className="trade-receipt trade-receipt--success">
          <div className="trade-receipt__title">
            {side === "buy" ? "Buy confirmed" : "Sell confirmed"} · paper
          </div>
          <div className="trade-receipt__row">
            <span>Position</span>
            <strong className="num">#{receipt.position_id}</strong>
          </div>
          <div className="trade-receipt__row">
            <span>{side === "buy" ? "Paid" : "Received"}</span>
            <strong className="num">
              {formatUsd(side === "buy" ? receipt.usd_paid : receipt.usd_received)}
            </strong>
          </div>
          <div className="trade-receipt__row">
            <span>Price</span>
            <strong className="num">{formatUsd(receipt.price, { decimals: 4 })}</strong>
          </div>
          <div className="trade-receipt__row">
            <span>Qty</span>
            <strong className="num">{Number(receipt.qty).toFixed(4)} {receipt.token}</strong>
          </div>
          {receipt.pnl_usd != null ? (
            <div className="trade-receipt__row">
              <span>PnL</span>
              <strong className={`num ${receipt.pnl_usd >= 0 ? "positive" : "negative"}`}>
                {formatPnl(receipt.pnl_usd)}
              </strong>
            </div>
          ) : null}
          <div className="trade-receipt__row">
            <span>Tx</span>
            <strong className="num trade-receipt__tx">{receipt.tx}</strong>
          </div>
          <div className="trade-receipt__row">
            <span>Time</span>
            <strong className="num">{formatAlertTime(receipt.timestamp)}</strong>
          </div>
        </div>
      ) : null}

      <section className="about-panel">
        <h4>About {fomoSymbol}</h4>
        <p>No description found</p>

        <div className="perf-grid">
          {Object.entries(performance).map(([label, value]) => (
            <div key={label} className="perf-grid__item">
              <span>{label}</span>
              <strong
                className={`num ${String(value).startsWith("+") ? "positive" : String(value).startsWith("-") ? "negative" : ""}`}
              >
                {value}
              </strong>
            </div>
          ))}
        </div>

        <div className="sentiment-block">
          <div className="sentiment-label">
            <span>Buys vs sells</span>
            <span className="num">
              <span className="positive">{buys.toLocaleString()}</span>
              {" vs "}
              <span className="negative">{sells.toLocaleString()}</span>
            </span>
          </div>
          <div className="sentiment-bar">
            <div className="sentiment-bar__buy" style={{ width: `${buyPct}%` }} />
            <div className="sentiment-bar__sell" style={{ width: `${100 - buyPct}%` }} />
          </div>

          <div className="sentiment-label">
            <span>Volume</span>
            <span className="num">
              <span className="positive">{buyVol}%</span>
              {" / "}
              <span className="negative">{sellVol}%</span>
            </span>
          </div>
          <div className="sentiment-bar">
            <div className="sentiment-bar__buy" style={{ width: `${buyVol}%` }} />
            <div className="sentiment-bar__sell" style={{ width: `${sellVol}%` }} />
          </div>

          <div className="sentiment-label">
            <span>Buyers vs sellers</span>
            <span className="num">
              <span className="positive">{buyers.toLocaleString()}</span>
              {" vs "}
              <span className="negative">{sellers.toLocaleString()}</span>
            </span>
          </div>
          <div className="sentiment-bar">
            <div className="sentiment-bar__buy" style={{ width: `${buyerPct}%` }} />
            <div className="sentiment-bar__sell" style={{ width: `${100 - buyerPct}%` }} />
          </div>
        </div>

        <div className="social-links">
          <a className="social-links__btn" href={fomoTokenUrl(fomoSymbol)} target="_blank" rel="noreferrer">
            Website
          </a>
          <a className="social-links__btn" href={xSearchUrl(`$${fomoSymbol}`)} target="_blank" rel="noreferrer">
            Twitter
          </a>
          <a className="social-links__btn" href={xSearchUrl(fomoSymbol)} target="_blank" rel="noreferrer">
            Search on X
          </a>
        </div>
      </section>

      <section className="positions-panel">
        <div className="positions-panel__header">
          <h4>Copy-trader CLI</h4>
        </div>
        <CopyTraderCli refreshKey={refreshKey} />
      </section>
    </aside>
  );
}
