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
  thesisCount = null,
  onLoadThesis,
}) {
  const tabs = [
    { id: "holders", label: "Holders", count: holderCount },
    { id: "swaps", label: "Swaps" },
    { id: "thesis", label: "Thesis", count: thesisCount },
  ];

  function formatCount(count) {
    if (count == null) {
      return null;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count;
  }

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
            {tab.count != null ? <span>({formatCount(tab.count)})</span> : null}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? <p className="sidebar-status" style={{ padding: "12px 14px" }}>Loading...</p> : null}

        {activeTab === "thesis" && !loading && !thesisLoaded ? (
          <div className="thesis-load-prompt">
            <p className="sidebar-status">
              {LIVE_API_ENABLED
                ? "Thesis data loads on demand to save API credits."
                : "Thesis data will be available when live API is enabled."}
            </p>
            {thesisError ? <p className="sidebar-status sidebar-status--error">{thesisError}</p> : null}
            {LIVE_API_ENABLED ? (
              <button type="button" className="thesis-load-btn" onClick={onLoadThesis}>
                Load thesis
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && rows.length === 0 && activeTab === "holders" ? (
          <p className="sidebar-status" style={{ padding: "12px 14px" }}>
            {tokenLive ? "No holders found." : tokenError || "Could not load holders."}
          </p>
        ) : null}

        {!loading && rows.length === 0 && activeTab === "thesis" && thesisLoaded ? (
          <p className="sidebar-status" style={{ padding: "12px 14px" }}>No thesis posts yet for {symbol}.</p>
        ) : null}

        {!loading && activeTab === "swaps" ? (
          <p className="sidebar-status" style={{ padding: "12px 14px" }}>Swaps feed coming soon.</p>
        ) : null}

        {rows.length > 0 && activeTab !== "swaps" ? (
          <table className="holders-table">
            <thead>
              <tr>
                <th>Trader</th>
                <th>{activeTab === "thesis" ? "Trade" : "Position"}</th>
                <th>{activeTab === "thesis" ? "Engagement" : "PnL"}</th>
                <th>{activeTab === "thesis" ? "Equity" : "Avg. entry"}</th>
                <th>Thesis</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.handle}-${row.name}`} className={row.isTeam ? "team-row" : ""}>
                  <td>
                    {row.isTeam ? (
                      <div className="trader-cell">
                        <div className="trader-cell__name" style={{ color: "var(--purple)" }}>
                          {row.name}
                        </div>
                      </div>
                    ) : (
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
                          {row.handle ? <div className="trader-cell__handle">{row.handle}</div> : null}
                        </div>
                      </a>
                    )}
                  </td>
                  <td className="num">
                    {row.isTeam ? row.position : activeTab === "thesis" ? row.position : `${row.position} ${symbol}`}
                  </td>
                  <td>
                    {!row.isTeam ? (
                      <>
                        <div
                          className={`pnl-cell num ${String(row.pnlPct).startsWith("+") ? "positive" : String(row.pnlPct).startsWith("-") ? "negative" : ""}`}
                        >
                          {row.pnlPct}
                        </div>
                        <div className="subtle num">{row.pnlUsd}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">{row.avgEntry}</td>
                  <td className="thesis-cell">{row.thesis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {holderCount != null && holdersShown != null && holdersShown < holderCount && rows.length > 0 ? (
          <p className="sidebar-status" style={{ padding: "8px 14px" }}>
            Showing {holdersShown} of {formatCount(holderCount)} holders
          </p>
        ) : null}
      </div>
    </div>
  );
}
