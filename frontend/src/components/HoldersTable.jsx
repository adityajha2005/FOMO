import { HOLDERS } from "../data/mockData.js";

export default function HoldersTable({ rows = HOLDERS, symbol = "PONS" }) {
  return (
    <div className="holders-panel">
      <div className="holders-tabs">
        <button type="button" className="holders-tabs__item active">
          Holders <span>28.9K</span>
        </button>
        <button type="button" className="holders-tabs__item">
          Swaps
        </button>
        <button type="button" className="holders-tabs__item">
          Thesis
        </button>
      </div>

      <div className="table-wrap">
        <table className="holders-table">
          <thead>
            <tr>
              <th>Trader</th>
              <th>Position</th>
              <th>PnL</th>
              <th>Avg. Entry</th>
              <th>Thesis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.handle}>
                <td>
                  <div className="trader-cell">
                    <div className="avatar avatar--sm">{row.name[0]}</div>
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
                  {row.position} {symbol}
                </td>
                <td>
                  <div className="pnl-cell positive">{row.pnlPct}</div>
                  <div className="subtle">{row.pnlUsd}</div>
                </td>
                <td>{row.avgEntry}</td>
                <td className="thesis-cell">{row.thesis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
