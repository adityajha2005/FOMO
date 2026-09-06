import { useEffect, useState } from "react";
import FooterTicker from "../components/FooterTicker.jsx";
import HoldersTable from "../components/HoldersTable.jsx";
import LeftSidebar from "../components/LeftSidebar.jsx";
import PriceChart from "../components/PriceChart.jsx";
import TopNav from "../components/TopNav.jsx";
import TradePanel from "../components/TradePanel.jsx";
import { api } from "../services/api.js";

const TOKEN_STATS = {
  marketCap: "$934.1M",
  price: "$0.934",
  change: "+12.98%",
  volume: "$145.7M",
  liquidity: "$6.7M",
};

export default function TradingDashboard() {
  const [activeTab, setActiveTab] = useState("Leaderboard");
  const [tradeSide, setTradeSide] = useState("buy");
  const [currentCoin, setCurrentCoin] = useState(null);
  const [portfolioUsd, setPortfolioUsd] = useState(0);
  const [apiOnline, setApiOnline] = useState(false);

  const symbol = currentCoin?.symbol || "PONS";

  useEffect(() => {
    let active = true;

    async function loadBotData() {
      try {
        const [coin, valueHistory] = await Promise.all([
          api.getCurrentCoin(),
          api.getTotalValueHistory("1d"),
        ]);

        if (!active) {
          return;
        }

        setCurrentCoin(coin);
        setApiOnline(true);

        if (Array.isArray(valueHistory) && valueHistory.length > 0) {
          setPortfolioUsd(Number(valueHistory.at(-1).usd) || 0);
        }
      } catch {
        if (active) {
          setApiOnline(false);
        }
      }
    }

    loadBotData();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dashboard-shell">
      <TopNav portfolioUsd={portfolioUsd} cashUsd={portfolioUsd * 0.18} />

      <div className="dashboard-body">
        <LeftSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="main-panel">
          <section className="token-header">
            <div className="token-header__left">
              <div className="token-icon">{symbol.slice(0, 1)}</div>
              <div>
                <div className="token-header__title">
                  <h1>{symbol}</h1>
                  <span className="token-tag">Spot</span>
                  {!apiOnline ? <span className="token-tag muted">Demo mode</span> : null}
                </div>
                <div className="token-header__links">
                  <button type="button">Copy</button>
                  <button type="button">Share</button>
                  <button type="button">Website</button>
                  <button type="button">Search</button>
                </div>
              </div>
            </div>

            <div className="token-stats">
              <Stat label="Market Cap" value={TOKEN_STATS.marketCap} />
              <Stat label="Price" value={TOKEN_STATS.price} />
              <Stat label="24H Change" value={TOKEN_STATS.change} positive />
              <Stat label="24H Volume" value={TOKEN_STATS.volume} />
              <Stat label="Liquidity" value={TOKEN_STATS.liquidity} />
            </div>
          </section>

          <PriceChart symbol={symbol} />
          <HoldersTable symbol={symbol} />
        </main>

        <TradePanel symbol={symbol} side={tradeSide} onSideChange={setTradeSide} />
      </div>

      <FooterTicker />
    </div>
  );
}

function Stat({ label, value, positive = false }) {
  return (
    <div className="token-stat">
      <span>{label}</span>
      <strong className={positive ? "positive" : undefined}>{value}</strong>
    </div>
  );
}
