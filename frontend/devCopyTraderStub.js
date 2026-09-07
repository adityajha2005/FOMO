/** Paper snapshot when the Flask API on :5123 is not running in local dev. */
export function copyTraderDevStub() {
  const now = Date.now() / 1000;

  return {
    mode: "paper",
    account_usd: 1000,
    session_started: now - 3600,
    updated_at: now,
    dev_stub: true,
    stats: {
      realized_pnl: 0,
      unrealized_pnl: 0,
      total_pnl: 101.5,
      roi_pct: 10.15,
      win_rate: null,
      wins: 0,
      losses: 0,
      closed_trades: 0,
      open_count: 0,
      open_value: 0,
      open_capital: 0,
      day_pnl: 0,
      session_hours: 1,
    },
    open_positions: [],
    closed_positions: [],
    events: [],
  };
}
