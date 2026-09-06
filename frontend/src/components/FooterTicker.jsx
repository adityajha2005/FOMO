import { useEffect, useState } from "react";
import { getMarketTicker } from "../services/binanceApi.js";
import { TICKER } from "../data/mockData.js";

export default function FooterTicker() {
  const [items, setItems] = useState(TICKER);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTicker() {
      try {
        const next = await getMarketTicker();
        if (active) {
          setItems(next);
          setLive(true);
        }
      } catch {
        if (active) {
          setLive(false);
        }
      }
    }

    loadTicker();
    const intervalId = window.setInterval(loadTicker, 15_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <footer className="footer-ticker">
      <div className="footer-ticker__track">
        {[...items, ...items].map((item, index) => (
          <div key={`${item.symbol}-${index}`} className="ticker-item">
            <strong>{item.symbol}</strong>
            <span>{item.price}</span>
            <span className={item.up ? "positive" : "negative"}>{item.change}</span>
          </div>
        ))}
      </div>
      <div className="footer-ticker__meta">
        <span className={`status-dot ${live ? "status-dot--live" : ""}`} />
        <span>{live ? "Live prices" : "Price feed offline"}</span>
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
      </div>
    </footer>
  );
}
