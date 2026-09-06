import { formatAlertTime } from "../utils/format.js";

const CLAN_COLORS = ["#f97316", "#8b5cf6", "#06b6d4", "#22c55e", "#eab308", "#ec4899"];

function Avatar({ url, initials, className = "avatar avatar--sm" }) {
  if (url) {
    return (
      <div className={className}>
        <img src={url} alt="" loading="lazy" />
      </div>
    );
  }

  return <div className={className}>{initials}</div>;
}

const tabs = ["Alerts", "Tokens", "Leaderboard", "Feed"];

export default function LeftSidebar({
  activeTab = "Leaderboard",
  onTabChange,
  clans = [],
  leaderboard = [],
  alerts = [],
  alertsConnected = false,
  alertsDelaySeconds = null,
  loading = false,
  error = null,
  liveSource = null,
}) {
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

      {activeTab === "Alerts" ? (
        <section className="sidebar-section sidebar-section--grow">
          <div className="sidebar-section__header">
            <h3>Live feed</h3>
            <span className="sidebar-live-pill">
              {alertsConnected ? "Connected" : "Connecting"}
              {alertsDelaySeconds ? ` · ${alertsDelaySeconds}s delay` : ""}
            </span>
          </div>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <p className="sidebar-status">Waiting for live trades...</p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id || `${alert.trader}-${alert.ts}`} className="alert-item">
                  <div className={`alert-item__type ${alert.type || alert.alertType || "buy"}`}>
                    {(alert.type || alert.alertType || "trade").toUpperCase()}
                  </div>
                  <div className="alert-item__body">
                    <strong>{alert.text || `${alert.trader} ${alert.type} ${alert.token}`}</strong>
                    <span>
                      {alert.trader} · {alert.token} · {formatAlertTime(alert.ts)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeTab !== "Alerts" ? (
        <>
          <section className="sidebar-section">
            <div className="sidebar-section__header">
              <h3>Clans</h3>
              <button type="button" className="link-btn">View all</button>
            </div>

            {error ? <p className="sidebar-status sidebar-status--error">{error}</p> : null}
            {liveSource ? <p className="sidebar-status">Live via {liveSource}</p> : null}

            <div className="clans-grid">
              {loading && clans.length === 0
                ? Array.from({ length: 4 }, (_, index) => (
                    <div key={index} className="clan-card clan-card--loading" />
                  ))
                : clans.map((clan, index) => (
                    <div key={clan.id || clan.name} className="clan-card">
                      <div
                        className="clan-card__avatar"
                        style={clan.avatarUrl ? undefined : { background: CLAN_COLORS[index % CLAN_COLORS.length] }}
                      >
                        {clan.avatarUrl ? (
                          <img src={clan.avatarUrl} alt="" loading="lazy" />
                        ) : (
                          clan.initials
                        )}
                      </div>
                      <div className="clan-card__meta">
                        <strong>{clan.name}</strong>
                        <span>{clan.members} members</span>
                      </div>
                      <div className={clan.pnlRaw >= 0 ? "clan-card__pnl positive" : "clan-card__pnl negative"}>
                        {clan.pnl}
                      </div>
                    </div>
                  ))}
            </div>
          </section>

          <section className="sidebar-section sidebar-section--grow">
            <div className="sidebar-section__header">
              <h3>Leaderboard</h3>
              <button type="button" className="link-btn">View all</button>
            </div>

            <div className="leaderboard-list">
              {loading && leaderboard.length === 0 ? (
                <p className="sidebar-status">Loading live leaderboard...</p>
              ) : null}

              {leaderboard.map((entry) => (
                <div key={entry.id || entry.rank} className="leaderboard-item">
                  <span className="leaderboard-item__rank">{entry.rank}</span>
                  <Avatar url={entry.avatarUrl} initials={entry.initials} />
                  <div className="leaderboard-item__info">
                    <strong>{entry.name}</strong>
                    <span>{entry.handle}</span>
                  </div>
                  <div className={entry.pnlRaw >= 0 ? "leaderboard-item__pnl positive" : "leaderboard-item__pnl negative"}>
                    {entry.pnl}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </aside>
  );
}
