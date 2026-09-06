import { useEffect, useState } from "react";
import { formatAlertTime } from "../utils/format.js";
import { fomoTraderUrl, openExternal } from "../utils/links.js";
import { getTrendingTokens, mapTrendingToken } from "../services/fomoApi.js";
import { TRENDING_TOKENS } from "../data/mockData.js";
import { LIVE_API_ENABLED } from "../config/api.js";

const WINDOWS = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "all", label: "ALL" },
];

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
  leaderboardWindow = "24h",
  onWindowChange,
  clanSource = "fomo.family",
  clanTokenError = null,
}) {
  const [trendingTokens, setTrendingTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);

  const displayClans = (allClans.length > 0 ? allClans : clans).slice(0, 6);

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
      <section className="sidebar-section">
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
                    {alertsDelaySeconds ? ` · ${alertsDelaySeconds}s delay` : ""}
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

      <div className="sidebar-scroll">
        {activeTab === "Alerts" || activeTab === "Feed" ? renderAlerts() : null}

        {activeTab === "Tokens" ? (
          <section className="sidebar-section">
            <div className="sidebar-section__header">
              <h3>Trending</h3>
            </div>
            {tokensLoading ? <p className="sidebar-status">Loading...</p> : null}
            {trendingTokens.map((token) => (
              <a
                key={token.address || token.symbol}
                className="token-list-row"
                href={`https://fomo.family/token/${encodeURIComponent(token.symbol)}`}
                target="_blank"
                rel="noreferrer"
              >
                <div>
                  <strong>{token.symbol}</strong>
                  <div className="subtle">{token.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="num">{token.price}</div>
                  <div className={`num ${token.changePositive ? "positive" : "negative"}`}>{token.change}</div>
                </div>
              </a>
            ))}
          </section>
        ) : null}

        {activeTab === "Leaderboard" ? (
          <>
            <section className="sidebar-section">
              <div className="sidebar-section__header">
                <h3>
                  Clans
                  <span className="badge-new">New</span>
                </h3>
                {clanSource === "estimated" ? (
                  <span className="sidebar-section__hint sidebar-section__hint--warn">
                    {clanTokenError === "expired"
                      ? "FOMO_TOKEN expired — copy a fresh one from fomo.family DevTools → Network"
                      : "Add FOMO_TOKEN to frontend/.env for live clan data (fomoapi key alone is not enough)"}
                  </span>
                ) : null}
              </div>

              {error ? <p className="sidebar-status sidebar-status--error">{error}</p> : null}

              <div className="clan-grid">
                {loading && displayClans.length === 0
                  ? Array.from({ length: 4 }, (_, index) => (
                      <div key={index} className="clan-card" style={{ opacity: 0.4 }} />
                    ))
                  : displayClans.map((clan) => (
                      <button
                        key={clan.id || clan.name}
                        type="button"
                        className="clan-card"
                        onClick={() => openExternal("https://fomo.family/clans")}
                      >
                        <div className="clan-card__top">
                          <div className="clan-card__avatar" style={{ background: clan.color || "var(--bg-hover)" }}>
                            {clan.avatarUrl ? <img src={clan.avatarUrl} alt="" /> : clan.initials || clan.name.slice(0, 2)}
                          </div>
                          <span className="clan-card__name">{clan.name}</span>
                        </div>
                        <div className="clan-card__meta">
                          <span className="clan-card__members">{clan.members} members</span>
                          <span className={`clan-card__pnl num ${clan.pnlRaw >= 0 ? "positive" : "negative"}`}>
                            {clan.pnl}
                          </span>
                        </div>
                      </button>
                    ))}
              </div>
            </section>

            <section className="sidebar-section">
              <div className="window-filters">
                {WINDOWS.map((window) => (
                  <button
                    key={window.id}
                    type="button"
                    className={leaderboardWindow === window.id ? "window-filters__btn active" : "window-filters__btn"}
                    onClick={() => onWindowChange?.(window.id)}
                  >
                    {window.label}
                  </button>
                ))}
              </div>

              <div className="leaderboard-rank-row">
                <span>Your rank</span>
                <span>—</span>
              </div>

              <div className="sidebar-section__header">
                <h3>PnL</h3>
              </div>

              <div className="leaderboard-list">
                {loading && leaderboard.length === 0 ? (
                  <p className="sidebar-status">Loading rankings...</p>
                ) : null}

                {leaderboard.map((entry) => (
                  <button
                    key={entry.id || entry.rank}
                    type="button"
                    className="leaderboard-row"
                    onClick={() => openTrader(entry.handle || entry.name)}
                  >
                    <span className="leaderboard-row__rank num">{entry.rank}</span>
                    <Avatar url={entry.avatarUrl} initials={entry.initials} />
                    <div className="leaderboard-row__info">
                      <div className="leaderboard-row__name">{entry.name}</div>
                      <div className="leaderboard-row__handle">{entry.handle}</div>
                    </div>
                    <span className={`leaderboard-row__pnl num ${entry.pnlRaw >= 0 ? "positive" : "negative"}`}>
                      {entry.pnl}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-footer__btn">
          Split bottom
        </button>
        <button type="button" className="sidebar-footer__btn">
          Split right
        </button>
      </div>
    </aside>
  );
}
