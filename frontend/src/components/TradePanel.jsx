export default function TradePanel({ symbol = "PONS", side, onSideChange }) {
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

      <label className="field-label">Amount</label>
      <div className="amount-input">
        <input defaultValue="0.00" />
        <span>USD</span>
      </div>

      <div className="quick-amounts">
        {["$10", "$100", "$500", "$1000"].map((amount) => (
          <button key={amount} type="button" className="quick-amounts__btn">
            {amount}
          </button>
        ))}
      </div>

      <button type="button" className={`action-btn ${side}`}>
        {side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
      </button>

      <section className="about-panel">
        <h4>About</h4>
        <p>
          Automated bridge rotation bot tracking supported altcoins and swapping into stronger
          momentum when ratio thresholds are met.
        </p>

        <div className="perf-grid">
          {[
            ["5M", "+0.8%"],
            ["1H", "+2.4%"],
            ["4H", "+6.1%"],
            ["1D", "+12.98%"],
          ].map(([label, value]) => (
            <div key={label} className="perf-grid__item">
              <span>{label}</span>
              <strong className="positive">{value}</strong>
            </div>
          ))}
        </div>

        <div className="sentiment-block">
          <div className="sentiment-row">
            <span>Buys</span>
            <strong>1,204</strong>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__buy" style={{ width: "68%" }} />
          </div>
          <div className="sentiment-row">
            <span>Sells</span>
            <strong>566</strong>
          </div>
          <div className="progress-bar">
            <div className="progress-bar__sell" style={{ width: "32%" }} />
          </div>
        </div>

        <div className="social-links">
          <button type="button" className="social-links__btn">Website</button>
          <button type="button" className="social-links__btn">Twitter</button>
          <button type="button" className="social-links__btn">Search on X</button>
        </div>
      </section>
    </aside>
  );
}
