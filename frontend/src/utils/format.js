export function formatPnl(value) {
  const amount = Number(value) || 0;
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? "+" : "-";

  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }

  if (abs >= 1_000) {
    return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  return `${sign}$${abs.toFixed(2)}`;
}

/** Full-precision PnL like fomo.family trader leaderboard (+$5,859,358.37). */
export function formatLeaderboardPnl(value) {
  const amount = Number(value) || 0;
  const sign = amount >= 0 ? "+" : "-";
  const abs = Math.abs(amount);

  if (abs >= 1_000) {
    return `${sign}$${abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${sign}$${abs.toFixed(2)}`;
}

export function formatUsd(value, { compact = false, decimals = 2 } = {}) {
  const amount = Number(value) || 0;

  if (compact) {
    if (Math.abs(amount) >= 1_000_000_000) {
      return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    }

    if (Math.abs(amount) >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(1)}M`;
    }

    if (Math.abs(amount) >= 1_000) {
      return `$${(amount / 1_000).toFixed(1)}K`;
    }
  }

  if (amount >= 1) {
    return `$${amount.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }

  return `$${amount.toFixed(Math.max(decimals, 4))}`;
}

export function formatPercent(value) {
  const amount = Number(value) || 0;
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${amount.toFixed(2)}%`;
}

export function formatAlertTime(timestamp) {
  const value = Number(timestamp) || Date.now();
  const ms = value > 1e12 ? value : value * 1000;
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
