import CopyTraderCli from "./CopyTraderCli.jsx";
import { fomoTokenUrl, xSearchUrl } from "../utils/links.js";

export default function TradePanel({ fomoSymbol = "PONS", tokenStats = null }) {
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

  return (
    <aside className="trade-panel">
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
            <div className="sentiment-bar__sell" style={{ width: `${100 - buyVol}%` }} />
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
        <CopyTraderCli />
      </section>
    </aside>
  );
}
