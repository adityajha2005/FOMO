function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function styleOf(trades, avgSize, followers) {
  if (trades > 180 && avgSize < 2500) return "Trencher";
  if (followers > 80000 && trades < 60) return "Holder";
  if (trades > 80) return "Flipper";
  return "Holder";
}

function archetypeFor(style, risk, speed) {
  if (style === "Trencher" || (risk > 65 && speed > 70)) return "Aggressive Trader";
  if (style === "Holder") return "Conviction Holder";
  if (speed > 75) return "Momentum Trader";
  return "Tactical Flipper";
}

function buildThesisBullets(row, style, confidence) {
  const positive = confidence >= 70;
  const bullets = [];

  if (style === "Trencher" || style === "Flipper") {
    bullets.push({ text: "Momentum acceleration", tone: "good" });
    bullets.push({ text: "Volume breakout on entry window", tone: "good" });
  } else {
    bullets.push({ text: "Thesis-led accumulation", tone: "good" });
    bullets.push({ text: "Extended hold discipline", tone: "good" });
  }

  if (row.followers > 50000) {
    bullets.push({ text: `${Math.min(5, Math.floor(row.followers / 40000))} smart wallets entered`, tone: "good" });
  } else {
    bullets.push({ text: "Cluster overlap with top 30", tone: "good" });
  }

  if (row.pnlRaw > 0) {
    bullets.push({ text: `Already +${Math.min(48, Math.round((row.pnlRaw / Math.max(row.volumeRaw, 1)) * 100))}% from window low`, tone: "warn" });
  }

  bullets.push({
    text: positive ? "Similar setup worked 7/10 times before" : "Mixed historical win rate on this setup",
    tone: positive ? "good" : "warn",
  });

  return bullets.slice(0, 5);
}

export function buildTraderProfile(row, rank = 1) {
  const trades = Number(row.trades) || 0;
  const volume = Number(row.volumeRaw) || 0;
  const pnl = Number(row.pnlRaw) || 0;
  const followers = Number(row.followers) || 0;
  const avgSize = trades ? volume / trades : 0;
  const style = styleOf(trades, avgSize, followers);

  let risk = 50;
  if (pnl < 0) risk += 12;
  if (trades < 50) risk += 10;
  if (style === "Trencher") risk += 12;
  if (rank <= 10) risk -= 8;
  risk = clamp(Math.round(risk), 18, 94);

  let conviction = 40 + Math.min(22, followers / 4500);
  if (volume > 0) conviction += clamp((pnl / volume) * 35, -12, 18);
  if (style === "Holder") conviction += 12;
  conviction = clamp(Math.round(conviction), 22, 96);

  const speed = clamp(Math.round(28 + (trades / 420) * 55 + (volume / 1.2e6) * 18), 15, 98);
  const patience = clamp(Math.round(100 - speed * 0.55 + (style === "Holder" ? 28 : style === "Trencher" ? -18 : 0)), 12, 92);
  const leverage = clamp(Math.round(38 + (avgSize / 12000) * 34 + (row.mcapEth ? 18 : 0)), 20, 95);

  const winRate = clamp(Math.round(50 + (pnl > 0 ? 12 : -8) + (conviction - 50) * 0.25), 38, 88);
  const avgHoldDays = style === "Trencher" ? 0.4 : style === "Flipper" ? 2.4 : 7.8;
  const confidence = clamp(Math.round(conviction * 0.62 + speed * 0.18 + (pnl > 0 ? 14 : -6)), 48, 94);

  const ticker = (row.ticker || "$TOKEN").replace(/^\$/, "");
  const tradeUsd = avgSize || Math.max(1200, volume * 0.02);
  const priceChange = clamp(Math.round(18 + (speed - 50) * 0.4 + (pnl > 0 ? 12 : 0)), 8, 58);

  const tags = [];
  if (conviction >= 62) tags.push({ label: "High Conviction", tone: "green" });
  tags.push({ label: style === "Trencher" ? "Momentum Trader" : style, tone: "muted" });
  if (row.clan) tags.push({ label: row.clan, tone: "purple" });
  else tags.push({ label: "DeFi", tone: "purple" });

  return {
    rank,
    handle: row.handle,
    name: row.name || row.handle,
    wallet: row.wallet || row.contract,
    avatarUrl: row.avatarUrl,
    initials: row.initials || (row.name || row.handle || "?").slice(0, 1).toUpperCase(),
    tags,
    genome: {
      traits: { risk, speed, conviction, patience, leverage },
      archetype: archetypeFor(style, risk, speed),
      style,
      avgHoldDays,
      winRate,
      pnlPct90d: volume ? clamp((pnl / volume) * 100, -40, 85) : pnl > 0 ? 18.7 : -4.2,
      similarWallets: clamp(Math.round(8 + followers / 18000 + rank), 11, 42),
      topAssets: ["ETH", "SOL", ticker.slice(0, 4).toUpperCase()].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3),
    },
    mind: {
      latestTrade: {
        ticker: row.ticker || `$${ticker}`,
        side: "BUY",
        usd: tradeUsd,
        agoMin: clamp(8 + (rank * 3) % 45, 5, 52),
        price: `$0.0…${String(Math.abs(pnl) % 999).padStart(3, "0")}`,
        sizePct: clamp((tradeUsd / Math.max(volume, 1)) * 100, 0.4, 4.8).toFixed(1),
        entryType: style === "Trencher" ? "Market Buy" : "Limit Fill",
        network: row.walletIsSolana ? "Solana" : "Ethereum",
      },
      thesis: buildThesisBullets(row, style, confidence),
      likelyThesis: style === "Holder" ? "thesis continuation" : "momentum continuation",
      confidence,
      signals: {
        priceChange: `+${priceChange}% from 24h low`,
        smartWallets: `${Math.min(5, 2 + Math.floor(followers / 35000))} smart wallets entered`,
        volumeMultiple: `${(1.6 + speed / 55).toFixed(1)}x volume increase`,
      },
    },
  };
}

export function radarPolygon(traits, cx, cy, radius) {
  const keys = ["risk", "speed", "conviction", "patience", "leverage"];
  const points = keys.map((key, index) => {
    const angle = (Math.PI * 2 * index) / keys.length - Math.PI / 2;
    const value = (traits[key] ?? 0) / 100;
    const x = cx + Math.cos(angle) * radius * value;
    const y = cy + Math.sin(angle) * radius * value;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return points.join(" ");
}

export function radarAxisPoints(cx, cy, radius) {
  const labels = ["Risk", "Speed", "Conviction", "Patience", "Leverage"];
  return labels.map((label, index) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    return {
      label,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      lx: cx + Math.cos(angle) * (radius + 14),
      ly: cy + Math.sin(angle) * (radius + 14),
    };
  });
}
