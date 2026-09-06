import { CLANS, LEADERBOARD } from "../data/mockData.js";

const tabs = ["Alerts", "Tokens", "Leaderboard", "Feed"];

export default function LeftSidebar({ activeTab = "Leaderboard", onTabChange }) {
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

      <section className="sidebar-section">
        <div className="sidebar-section__header">
          <h3>Clans</h3>
          <button type="button" className="link-btn">View all</button>
        </div>
        <div className="clans-grid">
          {CLANS.map((clan) => (
            <div key={clan.name} className="clan-card">
              <div className="clan-card__avatar" style={{ background: clan.color }}>
                {clan.initials}
              </div>
              <div className="clan-card__meta">
                <strong>{clan.name}</strong>
                <span>{clan.members} members</span>
              </div>
              <div className="clan-card__pnl positive">{clan.pnl}</div>
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
          {LEADERBOARD.map((trader) => (
            <div key={trader.handle} className="leaderboard-item">
              <span className="leaderboard-item__rank">{trader.rank}</span>
              <div className="avatar avatar--sm">{trader.avatar}</div>
              <div className="leaderboard-item__info">
                <strong>{trader.name}</strong>
                <span>{trader.handle}</span>
              </div>
              <div className="leaderboard-item__pnl positive">{trader.pnl}</div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
