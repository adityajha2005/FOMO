import { TICKER } from "../data/mockData.js";

export default function FooterTicker() {
  return (
    <footer className="footer-ticker">
      <div className="footer-ticker__track">
        {[...TICKER, ...TICKER].map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="ticker-item">
            <strong>{item.symbol}</strong>
            <span>{item.price}</span>
            <span className={item.up ? "positive" : "negative"}>{item.change}</span>
          </div>
        ))}
      </div>
      <div className="footer-ticker__meta">
        <span className="status-dot" />
        <span>Minor issues</span>
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
      </div>
    </footer>
  );
}
