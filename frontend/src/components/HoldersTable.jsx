export default function HoldersTable({
  rows = [],
  symbol = "PONS",
  activeTab = "holders",
  onTabChange,
  holderCount = null,
  loading = false,
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

        {!loading && rows.length === 0 ? (
          <p className="sidebar-status">
            {activeTab === "swaps"
              ? "Swaps feed requires FOMO API key."
              : "Add FOMO_API_KEY to frontend/.env for live holders and thesis data."}
          </p>
        ) : null}

        {rows.length > 0 ? (
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
                    <div className="trader-cell">
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
                    </div>
                  </td>
                  <td>
                    {activeTab === "thesis" ? row.position : `${row.position} ${symbol}`}
                  </td>
                  <td>
                    <div className={`pnl-cell ${String(row.pnlPct).startsWith("+") ? "positive" : String(row.pnlPct).startsWith("-") ? "negative" : ""}`}>{row.pnlPct}</div>
                    <div className="subtle">{row.pnlUsd}</div>
                  </td>
                  <td>{row.avgEntry}</td>
                  <td className="thesis-cell">{row.thesis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
