import { useCallback, useEffect, useMemo, useState } from "react";
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
  clearLeaderboardCache,
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
  marketCap: "$922.2M",
  price: "$0.922",
  change: "+1.98%",
  changePositive: true,
  volume: "$143.6M",
  liquidity: "$7.1M",
  holderCount: 28900,
  thesisCount: 6574,
  address: "0x39dbed3a2bd333467115de45665cc57f813c4571",
  performance: {
    "5M": "+0.8%",
    "1H": "+2.4%",
    "4H": "+6.1%",
    "1D": "+1.98%",
  },
  sentiment: {
    buys: 2427,
    sells: 3727,
    buyers: 1528,
    sellers: 1806,
    buyVol: 39,
    sellVol: 61,
  },
};

const TEAM_ROW = {
  name: "Team holdings",
  handle: "",
  isTeam: true,
  position: "—",
  pnlPct: "—",
  pnlUsd: "—",
  avgEntry: "—",
  thesis: "",
};

export default function TradingDashboard() {
  const [activeTab, setActiveTab] = useState("Leaderboard");
  const [leaderboardWindow, setLeaderboardWindow] = useState("24h");
  const [holdersTab, setHoldersTab] = useState("holders");
  const [currentCoin, setCurrentCoin] = useState(null);
  const [portfolioUsd, setPortfolioUsd] = useState(0);
  const [clans, setClans] = useState(CLANS);
  const [leaderboard, setLeaderboard] = useState(LEADERBOARD);
  const [leaderboardLoading, setLeaderboardLoading] = useState(LIVE_API_ENABLED);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [leaderboardLive, setLeaderboardLive] = useState(false);
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
  const [clanSource, setClanSource] = useState("fomoapi");
  const [clanTokenError, setClanTokenError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const fomoSymbol = DEFAULT_TOKEN;

  const { alerts, connected: alertsConnected, delaySeconds: alertsDelaySeconds } = useFomoAlerts({
    enabled: LIVE_API_ENABLED && (activeTab === "Alerts" || activeTab === "Feed"),
  });

  const loadLeaderboard = useCallback(async () => {
    if (!LIVE_API_ENABLED) {
      return;
    }
    try {
      const { traders, clans: liveClans, clanSource: liveClanSource, clanTokenError: tokenErr } =
        await getLeaderboard({
        window: leaderboardWindow,
        limit: 30,
      });

      setLeaderboard(traders);
      setClans(liveClans.slice(0, 6));
      setAllClans(liveClans);
      setClanSource(liveClanSource || "fomoapi");
      setClanTokenError(tokenErr ?? null);
      setLeaderboardLive(true);
      setLeaderboardError(null);
    } catch (error) {
      setLeaderboardLive(false);
      setLeaderboardError(error.message || "Could not load leaderboard");
    } finally {
      setLeaderboardLoading(false);
    }
  }, [leaderboardWindow]);

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
      setHolderRows(HOLDERS.filter((row) => !row.isTeam));
      setTokenError(error.message || "Could not load token data");
    } finally {
      setTokenLoading(false);
    }
  }, [fomoSymbol]);

  const loadThesisData = useCallback(async () => {
    if (!LIVE_API_ENABLED || thesisLoaded || thesisLoading) {
      return;
    }

    setThesisLoading(true);
    setThesisError(null);

    try {
      const rows = await getTokenThesesCached(fomoSymbol);
      setThesisRows(rows);
      setThesisLoaded(true);
      setTokenStats((current) => ({ ...current, thesisCount: rows.length || current.thesisCount }));
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
      setHoldersShown(HOLDERS.length - 1);
      return undefined;
    }

    setLeaderboardLoading(true);
    clearLeaderboardCache();
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

        if (Array.isArray(valueHistory) && valueHistory.length > 0) {
          setPortfolioUsd(Number(valueHistory.at(-1).usd) || 0);
        }
      } catch {
        // bot optional
      }
    }

    loadBotData();

    return () => {
      active = false;
    };
  }, []);

  const displayHolders = useMemo(() => {
    if (holdersTab !== "holders") {
      return holdersTab === "thesis" ? thesisRows : [];
    }
    const rows = holderRows.filter((row) => !row.isTeam);
    return [TEAM_ROW, ...rows];
  }, [holdersTab, holderRows, thesisRows]);

  const tableRows = holdersTab === "thesis" ? thesisRows : holdersTab === "holders" ? displayHolders : [];
  const tableLoading = holdersTab === "thesis" ? thesisLoading : tokenLoading;

  const showActionMessage = useCallback((message) => {
    setActionMessage(message);
    window.setTimeout(() => setActionMessage(null), 2200);
  }, []);

  async function handleCopyAddress() {
    const copied = await copyText(tokenStats.address);
    showActionMessage(copied ? "Contract address copied." : "Could not copy address.");
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
          leaderboardWindow={leaderboardWindow}
          onWindowChange={setLeaderboardWindow}
          clanSource={clanSource}
          clanTokenError={clanTokenError}
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
                </div>
                <div className="token-header__actions">
                  <a className="icon-btn" href={fomoTokenUrl(fomoSymbol)} target="_blank" rel="noreferrer" title="Website">
                    ↗
                  </a>
                  <a className="icon-btn" href={xSearchUrl(`$${fomoSymbol}`)} target="_blank" rel="noreferrer" title="X">
                    𝕏
                  </a>
                  <button type="button" className="icon-btn" onClick={handleCopyAddress} title="Copy contract">
                    ⧉
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => sharePage({ title: fomoSymbol, url: fomoTokenUrl(fomoSymbol) })}
                    title="Favorite"
                  >
                    ☆
                  </button>
                </div>
              </div>
            </div>

            <div className="token-stats">
              <Stat label="Market Cap" value={tokenStats.marketCap} />
              <Stat label="Price" value={tokenStats.price} />
              <Stat label="24H Change" value={tokenStats.change} positive={tokenStats.changePositive} />
              <Stat label="24H Vol" value={tokenStats.volume} />
              {tokenStats.liquidity ? <Stat label="Liquidity" value={tokenStats.liquidity} /> : null}
            </div>
          </section>

          <PriceChart
            symbol={fomoSymbol}
            live={LIVE_API_ENABLED && (chartLive || leaderboardLive)}
            price={tokenStats.price}
          />

          <HoldersTable
            rows={tableRows}
            symbol={fomoSymbol}
            activeTab={holdersTab}
            onTabChange={setHoldersTab}
            holderCount={tokenStats.holderCount}
            thesisCount={tokenStats.thesisCount}
            holdersShown={holdersShown}
            loading={tableLoading}
            tokenLive={tokenLive}
            tokenError={tokenError}
            thesisLoaded={thesisLoaded}
            thesisError={thesisError}
            onLoadThesis={loadThesisData}
          />
        </main>

        <TradePanel fomoSymbol={fomoSymbol} tokenStats={tokenStats} />
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
