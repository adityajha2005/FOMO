import { useCallback, useEffect, useState } from "react";
import FooterTicker from "../components/FooterTicker.jsx";
import HoldersTable from "../components/HoldersTable.jsx";
import LeftSidebar from "../components/LeftSidebar.jsx";
import PriceChart from "../components/PriceChart.jsx";
import TopNav from "../components/TopNav.jsx";
import TradePanel from "../components/TradePanel.jsx";
import { CLANS, HOLDERS, LEADERBOARD } from "../data/mockData.js";
import { useFomoAlerts } from "../hooks/useFomoAlerts.js";
import { api } from "../services/api.js";
import {
  getClanLeaderboard,
  getLeaderboard,
  getTokenHolders,
  getTokenStats,
  getTokenTheses,
  mapHolderRow,
  mapThesisRow,
  mapTokenStats,
  searchToken,
} from "../services/fomoApi.js";

const DEFAULT_TOKEN = import.meta.env.VITE_DEFAULT_TOKEN || "PONS";

const FALLBACK_TOKEN_STATS = {
  marketCap: "$934.1M",
  price: "$0.934",
  change: "+12.98%",
  changePositive: true,
  volume: "$145.7M",
  liquidity: "$6.7M",
};

export default function TradingDashboard() {
  const [activeTab, setActiveTab] = useState("Leaderboard");
  const [tradeSide, setTradeSide] = useState("buy");
  const [holdersTab, setHoldersTab] = useState("holders");
  const [currentCoin, setCurrentCoin] = useState(null);
  const [portfolioUsd, setPortfolioUsd] = useState(0);
  const [apiOnline, setApiOnline] = useState(false);
  const [clans, setClans] = useState(CLANS);
  const [leaderboard, setLeaderboard] = useState(LEADERBOARD);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [leaderboardLive, setLeaderboardLive] = useState(false);
  const [liveSource, setLiveSource] = useState(null);
  const [tokenStats, setTokenStats] = useState(FALLBACK_TOKEN_STATS);
  const [holderRows, setHolderRows] = useState(HOLDERS);
  const [thesisRows, setThesisRows] = useState([]);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenLive, setTokenLive] = useState(false);
  const [chartLive, setChartLive] = useState(false);

  const symbol = currentCoin?.symbol || DEFAULT_TOKEN;

  const { alerts, connected: alertsConnected, delaySeconds: alertsDelaySeconds } = useFomoAlerts({
    enabled: true,
  });

  const loadLeaderboard = useCallback(async () => {
    try {
      const [{ traders, source }, { clans: liveClans }] = await Promise.all([
        getLeaderboard({ window: "7d", limit: 50 }),
        getClanLeaderboard({ window: "7d", limit: 50 }),
      ]);

      setLeaderboard(traders);
      setClans(liveClans.slice(0, 4));
      setLeaderboardLive(true);
      setLeaderboardError(null);
      setLiveSource(source);
    } catch (error) {
      setLeaderboardLive(false);
      setLeaderboardError(error.message || "Could not load live leaderboard");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const loadTokenData = useCallback(async () => {
    setTokenLoading(true);

    try {
      const token = await searchToken(symbol);
      if (!token?.address) {
        throw new Error("Token not found");
      }

      const [holders, stats, theses] = await Promise.all([
        getTokenHolders(token.address, { limit: 20, networkId: token.networkId }),
        getTokenStats(token.address, { networkId: token.networkId }),
        getTokenTheses(token.address, { limit: 20, networkId: token.networkId }),
      ]);

      setTokenStats(mapTokenStats(token, stats));
      setHolderRows(holders.map((row) => mapHolderRow(row, symbol)));
      setThesisRows(theses.map(mapThesisRow));
      setTokenLive(true);
      setChartLive(true);
    } catch {
      setTokenLive(false);
      setTokenStats(FALLBACK_TOKEN_STATS);
      setHolderRows(HOLDERS);
      setThesisRows([]);
    } finally {
      setTokenLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadLeaderboard();
    const intervalId = window.setInterval(loadLeaderboard, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadLeaderboard]);

  useEffect(() => {
    loadTokenData();
    const intervalId = window.setInterval(loadTokenData, 60_000);
    return () => window.clearInterval(intervalId);
  }, [loadTokenData]);

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
    const intervalId = window.setInterval(loadBotData, 30_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const tableRows = holdersTab === "thesis" ? thesisRows : holderRows;

  return (
    <div className="dashboard-shell">
      <TopNav portfolioUsd={portfolioUsd} cashUsd={portfolioUsd * 0.18} />

      <div className="dashboard-body">
        <LeftSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          clans={clans}
          leaderboard={leaderboard}
          alerts={alerts}
          alertsConnected={alertsConnected}
          alertsDelaySeconds={alertsDelaySeconds}
          loading={leaderboardLoading}
          error={leaderboardError}
          liveSource={liveSource}
        />

        <main className="main-panel">
          <section className="token-header">
            <div className="token-header__left">
              <div className="token-icon">{symbol.slice(0, 1)}</div>
              <div>
                <div className="token-header__title">
                  <h1>{symbol}</h1>
                  <span className="token-tag">Spot</span>
                  {!apiOnline ? <span className="token-tag muted">Bot offline</span> : null}
                  {leaderboardLive ? <span className="token-tag live">Live traders</span> : null}
                  {tokenLive ? <span className="token-tag live">Live token</span> : null}
                  {alertsConnected ? <span className="token-tag live">Live feed</span> : null}
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
              <Stat label="Market Cap" value={tokenStats.marketCap} />
              <Stat label="Price" value={tokenStats.price} />
              <Stat label="24H Change" value={tokenStats.change} positive={tokenStats.changePositive} />
              <Stat label="24H Volume" value={tokenStats.volume} />
              <Stat label="Liquidity" value={tokenStats.liquidity} />
            </div>
          </section>

          <PriceChart symbol={symbol} live={chartLive || leaderboardLive} />
          <HoldersTable
            rows={tableRows}
            symbol={symbol}
            activeTab={holdersTab}
            onTabChange={setHoldersTab}
            holderCount={tokenStats.holderCount}
            loading={tokenLoading}
          />
        </main>

        <TradePanel symbol={symbol} side={tradeSide} onSideChange={setTradeSide} tokenStats={tokenStats} />
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
