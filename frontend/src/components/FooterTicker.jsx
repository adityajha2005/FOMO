import { useEffect, useState } from "react";
import { TICKER_REFRESH_MS } from "../config/polling.js";
import { LIVE_API_ENABLED } from "../config/api.js";
import { getMarketTicker } from "../services/binanceApi.js";
import { binanceSymbolUrl } from "../utils/links.js";
import { TICKER } from "../data/mockData.js";

export default function FooterTicker() {
  const [items, setItems] = useState(TICKER);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      return undefined;
    }

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
    const intervalId = window.setInterval(loadTicker, TICKER_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <footer className="footer-ticker">
      <div className="footer-ticker__track">
        {[...items, ...items].map((item, index) => (
          <a
            key={`${item.symbol}-${index}`}
            className="ticker-item ticker-item--link"
            href={binanceSymbolUrl(item.symbol)}
            target="_blank"
            rel="noreferrer"
          >
            <strong>{item.symbol}</strong>
            <span>{item.price}</span>
            <span className={item.up ? "positive" : "negative"}>{item.change}</span>
          </a>
        ))}
      </div>
      <div className="footer-ticker__meta">
        <span className={`status-dot ${live ? "status-dot--live" : ""}`} />
        <span>{live ? "Market feed" : "Feed offline"}</span>
        <a href="https://fomo.family/privacy" target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a href="https://fomo.family/terms" target="_blank" rel="noreferrer">
          Terms
        </a>
      </div>
    </footer>
  );
}
