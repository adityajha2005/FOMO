const BINANCE_BASE = import.meta.env.PROD ? "/api/binance" : "https://api.binance.com";

const TICKER_SYMBOLS = [
  { symbol: "BTCUSDT", label: "BTC" },
  { symbol: "ETHUSDT", label: "ETH" },
  { symbol: "SOLUSDT", label: "SOL" },
  { symbol: "BNBUSDT", label: "BNB" },
  { symbol: "USDCUSDT", label: "USDC" },
];

function formatPrice(value) {
  const amount = Number(value) || 0;

  if (amount >= 1000) {
    return `$${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  if (amount >= 1) {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `$${amount.toFixed(4)}`;
}

function formatChange(value) {
  const amount = Number(value) || 0;
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${amount.toFixed(2)}%`;
}

export async function getMarketTicker() {
  const symbols = JSON.stringify(TICKER_SYMBOLS.map((item) => item.symbol));
  const response = await fetch(
    `${BINANCE_BASE}/api/v3/ticker/24hr?symbols=${encodeURIComponent(symbols)}`,
  );

  if (!response.ok) {
    throw new Error(`Binance ticker failed: ${response.status}`);
  }

  const rows = await response.json();
  const bySymbol = Object.fromEntries(rows.map((row) => [row.symbol, row]));

  return TICKER_SYMBOLS.map(({ symbol, label }) => {
    const row = bySymbol[symbol];
    const change = Number(row?.priceChangePercent) || 0;

    return {
      symbol: label,
      price: formatPrice(row?.lastPrice),
      change: formatChange(change),
      up: change >= 0,
    };
  });
}

export async function getKlines(symbol = "BTCUSDT", interval = "1h", limit = 120) {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  const response = await fetch(`${BINANCE_BASE}/api/v3/klines?${params}`);

  if (!response.ok) {
    throw new Error(`Binance klines failed: ${response.status}`);
  }

  const rows = await response.json();

  return rows.map(([openTime, open, high, low, close]) => ({
    time: Math.floor(openTime / 1000),
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
  }));
}
