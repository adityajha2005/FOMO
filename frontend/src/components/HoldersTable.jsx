import { fomoTraderUrl } from "../utils/links.js";
import { LIVE_API_ENABLED } from "../config/api.js";

export default function HoldersTable({
  rows = [],
  symbol = "PONS",
  activeTab = "holders",
  onTabChange,
  holderCount = null,
  holdersShown = null,
  loading = false,
  tokenLive = false,
  tokenError = null,
  thesisLoaded = false,
  thesisError = null,
  onLoadThesis,
}) {
  const tabs = [
    { id: "holders", label: "Holders", count: holderCount },
    { id: "thesis", label: "Thesis" },
    { id: "swaps", label: "Swaps" },
  ];

  return (
    <div className="holders-panel">
      <div className="holders-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "holders-tabs__item active" : "holders-tabs__item"}
            onClick={() => onTabChange?.(tab.id)}
          >
            {tab.label}
            {tab.count != null ? <span>{tab.count >= 1000 ? `${(tab.count / 1000).toFixed(1)}K` : tab.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? <p className="sidebar-status">Loading live {activeTab}...</p> : null}

        {activeTab === "thesis" && !loading && !thesisLoaded ? (
          <div className="thesis-load-prompt">
            <p className="sidebar-status">
              {LIVE_API_ENABLED
                ? "Thesis data is loaded on demand to reduce API usage."
                : "Thesis data will be available after API integration."}
            </p>
            {thesisError ? <p className="sidebar-status sidebar-status--error">{thesisError}</p> : null}
            {LIVE_API_ENABLED ? (
              <button type="button" className="thesis-load-btn" onClick={onLoadThesis}>
                Load thesis data
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && rows.length === 0 && activeTab === "holders" ? (
          <p className="sidebar-status">
            {tokenLive
              ? "No holders found for this token."
              : tokenError || "Could not load holders. Add FOMO_API_KEY to frontend/.env and restart the dev server."}
          </p>
        ) : null}

        {!loading && rows.length === 0 && activeTab === "thesis" && thesisLoaded ? (
          <p className="sidebar-status">No thesis posts yet for {symbol}.</p>
        ) : null}

        {!loading && rows.length === 0 && activeTab === "swaps" ? (
          <p className="sidebar-status">Swaps feed is not available yet.</p>
        ) : null}

        {rows.length > 0 ? (
          <>
            {holderCount != null && holdersShown != null && holdersShown < holderCount ? (
              <p className="sidebar-status">
                Showing {holdersShown} live FOMO traders of {holderCount >= 1000 ? `${(holderCount / 1000).toFixed(1)}K` : holderCount} total holders.
              </p>
            ) : null}
          <table className="holders-table">
            <thead>
              <tr>
                <th>Trader</th>
                <th>{activeTab === "thesis" ? "Trade" : "Position"}</th>
                <th>{activeTab === "thesis" ? "Engagement" : "PnL"}</th>
                <th>{activeTab === "thesis" ? "Equity" : "Avg. Entry"}</th>
                <th>Thesis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.handle}-${row.name}`}>
                  <td>
                    <a
                      className="trader-cell trader-cell--link"
                      href={fomoTraderUrl(row.handle)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.avatarUrl ? (
                        <div className="avatar avatar--sm">
                          <img src={row.avatarUrl} alt="" loading="lazy" />
                        </div>
                      ) : (
                        <div className="avatar avatar--sm">{row.name[0]}</div>
                      )}
                      <div>
                        <div className="trader-cell__name">
                          {row.name}
                          {row.badge ? <span className="badge">{row.badge}</span> : null}
                        </div>
                        <div className="trader-cell__handle">{row.handle}</div>
                      </div>
                    </a>
                  </td>
                  <td className="num">
                    {activeTab === "thesis" ? row.position : `${row.position} ${symbol}`}
                  </td>
                  <td>
                    <div className={`pnl-cell num ${String(row.pnlPct).startsWith("+") ? "positive" : String(row.pnlPct).startsWith("-") ? "negative" : ""}`}>{row.pnlPct}</div>
                    <div className="subtle num">{row.pnlUsd}</div>
                  </td>
                  <td className="num">{row.avgEntry}</td>
                  <td className="thesis-cell">{row.thesis}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        ) : null}
      </div>
    </div>
  );
}
