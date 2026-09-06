import { useEffect, useState } from "react";
import { formatAlertTime } from "../utils/format.js";
import { fomoTraderUrl, openExternal } from "../utils/links.js";
import { getTrendingTokens, mapTrendingToken } from "../services/fomoApi.js";
import { TRENDING_TOKENS } from "../data/mockData.js";
import { LIVE_API_ENABLED } from "../config/api.js";

function Avatar({ url, initials, className = "avatar avatar--sm" }) {
  if (url) {
    return (
      <div className={className}>
        <img src={url} alt="" loading="lazy" />
      </div>
    );
  }

  return <div className={`${className} avatar--fallback`}>{initials}</div>;
}

const tabs = ["Alerts", "Tokens", "Leaderboard", "Feed"];

export default function LeftSidebar({
  activeTab = "Leaderboard",
  onTabChange,
  clans = [],
  allClans = [],
  leaderboard = [],
  alerts = [],
  alertsConnected = false,
  alertsDelaySeconds = null,
  loading = false,
  error = null,
  liveSource = null,
}) {
  const [showAllClans, setShowAllClans] = useState(false);
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [trendingTokens, setTrendingTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);

  const visibleClans = showAllClans ? allClans : clans;
  const visibleLeaderboard = showAllLeaderboard ? leaderboard : leaderboard.slice(0, 10);

  useEffect(() => {
    if (activeTab !== "Tokens") {
      return undefined;
    }

    if (!LIVE_API_ENABLED) {
      setTrendingTokens(TRENDING_TOKENS);
      setTokensLoading(false);
      return undefined;
    }

    let active = true;
    setTokensLoading(true);

    getTrendingTokens()
      .then((tokens) => {
        if (active) {
          setTrendingTokens(tokens.map(mapTrendingToken));
        }
      })
      .catch(() => {
        if (active) {
          setTrendingTokens([]);
        }
      })
      .finally(() => {
        if (active) {
          setTokensLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab]);

  function openTrader(handle) {
    openExternal(fomoTraderUrl(handle));
  }

  function renderAlerts() {
    return (
      <section className="sidebar-section sidebar-section--grow">
        <div className="sidebar-section__header">
          <h3>Activity feed</h3>
          <span className={`status-chip ${alertsConnected ? "status-chip--live" : ""}`}>
            {alertsConnected ? "Live" : "Connecting"}
            {alertsDelaySeconds ? ` · ${alertsDelaySeconds}s` : ""}
          </span>
        </div>

        <div className="alerts-list">
          {alerts.length === 0 ? (
            <p className="sidebar-status">Waiting for market activity...</p>
          ) : (
            alerts.map((alert) => (
              <button
                key={alert.id || `${alert.trader}-${alert.ts}`}
                type="button"
                className="alert-item alert-item--clickable"
                onClick={() => alert.trader && openTrader(alert.trader)}
              >
                <div className={`alert-item__side ${alert.type || alert.alertType || "buy"}`}>
                  {(alert.type || alert.alertType || "trade").toUpperCase()}
                </div>
                <div className="alert-item__body">
                  <strong>{alert.text || `${alert.trader} ${alert.type} ${alert.token}`}</strong>
                  <span>
                    {alert.trader} · {alert.token} · {formatAlertTime(alert.ts)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <aside className="left-sidebar">
      <nav className="sidebar-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "sidebar-tabs__item active" : "sidebar-tabs__item"}
            onClick={() => onTabChange?.(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Alerts" || activeTab === "Feed" ? renderAlerts() : null}

      {activeTab === "Tokens" ? (
        <section className="sidebar-section sidebar-section--grow">
          <div className="sidebar-section__header">
            <h3>Trending</h3>
            <a className="link-btn" href="https://fomo.family" target="_blank" rel="noreferrer">
              Market
            </a>
          </div>

          <div className="data-list">
            {tokensLoading ? <p className="sidebar-status">Loading market data...</p> : null}
            {!tokensLoading && trendingTokens.length === 0 ? (
              <p className="sidebar-status">Trending data unavailable.</p>
            ) : null}
            {trendingTokens.map((token) => (
              <a
                key={token.address || token.symbol}
                className="data-list__row data-list__row--link"
                href={`https://fomo.family/token/${encodeURIComponent(token.symbol)}`}
                target="_blank"
                rel="noreferrer"
              >
                <div className="data-list__primary">
                  <strong>{token.symbol}</strong>
                  <span>{token.name}</span>
                </div>
                <div className="data-list__metrics">
                  <span className="num">{token.price}</span>
                  <span className={`num ${token.changePositive ? "positive" : "negative"}`}>{token.change}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === "Leaderboard" ? (
        <>
          <section className="sidebar-section">
            <div className="sidebar-section__header">
              <h3>Clans</h3>
              <button type="button" className="link-btn" onClick={() => setShowAllClans((current) => !current)}>
                {showAllClans ? "Less" : "All"}
              </button>
            </div>

            {error ? <p className="sidebar-status sidebar-status--error">{error}</p> : null}
            {liveSource ? <p className="sidebar-status">Source: {liveSource}</p> : null}

            <div className="data-list">
              {loading && visibleClans.length === 0
                ? Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="data-list__row data-list__row--loading" />
                  ))
                : visibleClans.map((clan) => (
                    <button
                      key={clan.id || clan.name}
                      type="button"
                      className="data-list__row data-list__row--button"
                      onClick={() => openExternal("https://fomo.family/clans")}
                    >
                      <div className="data-list__primary">
                        <strong>{clan.name}</strong>
                        <span>{clan.members} members</span>
                      </div>
                      <span className={`num ${clan.pnlRaw >= 0 ? "positive" : "negative"}`}>{clan.pnl}</span>
                    </button>
                  ))}
            </div>
          </section>

          <section className="sidebar-section sidebar-section--grow">
            <div className="sidebar-section__header">
              <h3>Top traders</h3>
              <button
                type="button"
                className="link-btn"
                onClick={() => setShowAllLeaderboard((current) => !current)}
              >
                {showAllLeaderboard ? "Less" : "All"}
              </button>
            </div>

            <div className="data-list data-list--ranked">
              {loading && visibleLeaderboard.length === 0 ? (
                <p className="sidebar-status">Loading rankings...</p>
              ) : null}

              {visibleLeaderboard.map((entry) => (
                <button
                  key={entry.id || entry.rank}
                  type="button"
                  className="data-list__row data-list__row--button data-list__row--ranked"
                  onClick={() => openTrader(entry.handle || entry.name)}
                >
                  <span className="data-list__rank num">{entry.rank}</span>
                  <Avatar url={entry.avatarUrl} initials={entry.initials} />
                  <div className="data-list__primary">
                    <strong>{entry.name}</strong>
                    <span>{entry.handle}</span>
                  </div>
                  <span className={`num ${entry.pnlRaw >= 0 ? "positive" : "negative"}`}>{entry.pnl}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </aside>
  );
}
