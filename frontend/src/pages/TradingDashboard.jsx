import { useCallback, useEffect, useState } from "react";
import FooterTicker from "../components/FooterTicker.jsx";
import HoldersTable from "../components/HoldersTable.jsx";
import LeftSidebar from "../components/LeftSidebar.jsx";
import PriceChart from "../components/PriceChart.jsx";
import TopNav from "../components/TopNav.jsx";
import TradePanel from "../components/TradePanel.jsx";
import { LEADERBOARD_REFRESH_MS } from "../config/polling.js";
import { LIVE_API_ENABLED } from "../config/api.js";
import { CLANS, HOLDERS, LEADERBOARD } from "../data/mockData.js";
import { useFomoAlerts } from "../hooks/useFomoAlerts.js";
import { api } from "../services/api.js";
import {
  getLeaderboard,
  getTokenBundle,
  getTokenThesesCached,
} from "../services/fomoApi.js";
import {
  copyText,
  fomoTokenUrl,
  sharePage,
  xSearchUrl,
} from "../utils/links.js";

const DEFAULT_TOKEN = import.meta.env.VITE_DEFAULT_TOKEN || "PONS";

const FALLBACK_TOKEN_STATS = {
  marketCap: "$934.1M",
  price: "$0.934",
  change: "+12.98%",
  changePositive: true,
  volume: "$145.7M",
  liquidity: "$6.7M",
  holderCount: 28800,
  address: "0x39dbed3a2bd333467115de45665cc57f813c4571",
  performance: {
    "5M": "+0.8%",
    "1H": "+2.4%",
    "4H": "+6.1%",
    "1D": "+12.98%",
  },
  sentiment: { buys: 1204, sells: 566 },
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
  const [leaderboardLoading, setLeaderboardLoading] = useState(LIVE_API_ENABLED);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [leaderboardLive, setLeaderboardLive] = useState(false);
  const [liveSource, setLiveSource] = useState(null);
  const [tokenStats, setTokenStats] = useState(FALLBACK_TOKEN_STATS);
  const [holderRows, setHolderRows] = useState(HOLDERS);
  const [thesisRows, setThesisRows] = useState([]);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [thesisLoading, setThesisLoading] = useState(false);
  const [tokenLive, setTokenLive] = useState(false);
  const [chartLive, setChartLive] = useState(false);
  const [thesisLoaded, setThesisLoaded] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const [thesisError, setThesisError] = useState(null);
  const [holdersShown, setHoldersShown] = useState(null);
  const [allClans, setAllClans] = useState(CLANS);
  const [actionMessage, setActionMessage] = useState(null);

  const fomoSymbol = DEFAULT_TOKEN;
  const tradeSymbol = currentCoin?.symbol || fomoSymbol;

  const { alerts, connected: alertsConnected, delaySeconds: alertsDelaySeconds } = useFomoAlerts({
    enabled: LIVE_API_ENABLED && (activeTab === "Alerts" || activeTab === "Feed"),
  });

  const loadLeaderboard = useCallback(async () => {
    if (!LIVE_API_ENABLED) {
      return;
    }
    try {
      const { traders, clans: liveClans, source } = await getLeaderboard({ window: "7d", limit: 30 });

      setLeaderboard(traders);
      setClans(liveClans.slice(0, 4));
      setAllClans(liveClans);
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
    if (!LIVE_API_ENABLED) {
      return;
    }

    setTokenLoading(true);
    setTokenError(null);

    try {
      const { stats, holders, holdersShown: shown, holderTotal } = await getTokenBundle(fomoSymbol);
      setTokenStats(stats);
      setHolderRows(holders);
      setHoldersShown(shown ?? holders.length);
      if (holderTotal != null) {
        setTokenStats((current) => ({ ...current, holderCount: holderTotal }));
      }
      setTokenLive(true);
      setChartLive(true);
    } catch (error) {
      setTokenLive(false);
      setTokenStats(FALLBACK_TOKEN_STATS);
      setHolderRows(HOLDERS);
      setTokenError(error.message || "Could not load token data");
    } finally {
      setTokenLoading(false);
    }
  }, [fomoSymbol]);

  const loadThesisData = useCallback(async () => {
    if (!LIVE_API_ENABLED) {
      return;
    }

    if (thesisLoaded || thesisLoading) {
      return;
    }

    setThesisLoading(true);
    setThesisError(null);

    try {
      const rows = await getTokenThesesCached(fomoSymbol);
      setThesisRows(rows);
      setThesisLoaded(true);
    } catch (error) {
      setThesisRows([]);
      setThesisError(error.message || "Could not load thesis data");
    } finally {
      setThesisLoading(false);
    }
  }, [fomoSymbol, thesisLoaded, thesisLoading]);

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      setLeaderboardLoading(false);
      setHoldersShown(HOLDERS.length);
      return undefined;
    }

    loadLeaderboard();
    if (!LEADERBOARD_REFRESH_MS) {
      return undefined;
    }

    const intervalId = window.setInterval(loadLeaderboard, LEADERBOARD_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [loadLeaderboard]);

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      return undefined;
    }

    setThesisLoaded(false);
    setThesisRows([]);
    setThesisError(null);
    loadTokenData();
  }, [loadTokenData, fomoSymbol]);

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      return undefined;
    }

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

  const tableRows = holdersTab === "thesis" ? thesisRows : holderRows;
  const tableLoading = holdersTab === "thesis" ? thesisLoading : tokenLoading;

  const showActionMessage = useCallback((message) => {
    setActionMessage(message);
    window.setTimeout(() => setActionMessage(null), 2200);
  }, []);

  async function handleCopyAddress() {
    const copied = await copyText(tokenStats.address);
    showActionMessage(copied ? "Contract address copied." : "Could not copy address.");
  }

  async function handleShareToken() {
    const shared = await sharePage({
      title: `${fomoSymbol} on fomo`,
      text: `Check out ${fomoSymbol} on fomo.family`,
      url: fomoTokenUrl(fomoSymbol),
    });
    showActionMessage(shared ? "Share link copied." : "Share cancelled.");
  }

  return (
    <div className="dashboard-shell">
      {actionMessage ? <div className="toast-banner">{actionMessage}</div> : null}
      <TopNav portfolioUsd={portfolioUsd} cashUsd={portfolioUsd * 0.18} />

      <div className="dashboard-body">
        <LeftSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          clans={clans}
          allClans={allClans}
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
              {tokenStats.imageUrl ? (
                <img className="token-icon token-icon--image" src={tokenStats.imageUrl} alt="" />
              ) : (
                <div className="token-icon">{fomoSymbol.slice(0, 1)}</div>
              )}
              <div>
                <div className="token-header__title">
                  <h1>{fomoSymbol}</h1>
                  <span className="token-tag">Spot</span>
                  {LIVE_API_ENABLED && tokenLive ? (
                    <span className="status-chip status-chip--live">Market data live</span>
                  ) : (
                    <span className="status-chip">UI preview</span>
                  )}
                </div>
                <div className="token-header__meta">
                  {tradeSymbol !== fomoSymbol ? (
                    <span className="token-meta-item">Bot pair: {tradeSymbol}/USDT</span>
                  ) : null}
                  {!apiOnline ? <span className="token-meta-item token-meta-item--warn">Bot offline</span> : null}
                  {tokenStats.address ? (
                    <span className="token-meta-item num">{tokenStats.address.slice(0, 6)}...{tokenStats.address.slice(-4)}</span>
                  ) : null}
                </div>
                <div className="token-header__links">
                  <button type="button" onClick={handleCopyAddress} disabled={!tokenStats.address}>
                    Copy contract
                  </button>
                  <button type="button" onClick={handleShareToken}>
                    Share
                  </button>
                  <a href={fomoTokenUrl(fomoSymbol)} target="_blank" rel="noreferrer">
                    Token page
                  </a>
                  <a href={xSearchUrl(fomoSymbol)} target="_blank" rel="noreferrer">
                    Research
                  </a>
                </div>
              </div>
            </div>

            <div className="token-stats">
              <Stat label="Market Cap" value={tokenStats.marketCap} />
              <Stat label="Last Price" value={tokenStats.price} />
              <Stat label="24H Change" value={tokenStats.change} positive={tokenStats.changePositive} />
              <Stat label="24H Volume" value={tokenStats.volume} />
              {tokenStats.liquidity ? <Stat label="Liquidity" value={tokenStats.liquidity} /> : null}
            </div>
          </section>

          <PriceChart symbol={tradeSymbol} live={LIVE_API_ENABLED && (chartLive || leaderboardLive)} />
          <HoldersTable
            rows={tableRows}
            symbol={fomoSymbol}
            activeTab={holdersTab}
            onTabChange={setHoldersTab}
            holderCount={tokenStats.holderCount}
            holdersShown={holdersShown}
            loading={tableLoading}
            tokenLive={tokenLive}
            tokenError={tokenError}
            thesisLoaded={thesisLoaded}
            thesisError={thesisError}
            onLoadThesis={loadThesisData}
          />
        </main>

        <TradePanel
          symbol={tradeSymbol}
          fomoSymbol={fomoSymbol}
          side={tradeSide}
          onSideChange={setTradeSide}
          tokenStats={tokenStats}
          botOnline={apiOnline}
        />
      </div>

      <FooterTicker />
    </div>
  );
}

function Stat({ label, value, positive = false }) {
  return (
    <div className="token-stat">
      <span>{label}</span>
      <strong className={`num ${positive ? "positive" : ""}`}>{value}</strong>
    </div>
  );
}
