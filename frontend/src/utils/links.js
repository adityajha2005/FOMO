export const FOMO_APP_URL = "https://fomo.family";
export const FOMO_API_URL = "https://fomoapi.io";
export const BINANCE_TESTNET_URL = "https://testnet.binance.vision";
export const BINANCE_DEPOSIT_URL = "https://www.binance.com/en/my/wallet/account/main/deposit/crypto";

export function fomoTokenUrl(symbol) {
  return `${FOMO_APP_URL}/token/${encodeURIComponent(symbol)}`;
}

export function fomoTraderUrl(handle) {
  const clean = String(handle || "").replace(/^@/, "");
  return `${FOMO_APP_URL}/@${encodeURIComponent(clean)}`;
}

export function fomoSearchUrl(query) {
  return `${FOMO_APP_URL}/?q=${encodeURIComponent(query)}`;
}

export function xSearchUrl(query) {
  return `https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`;
}

export function binanceTradeUrl(symbol) {
  return `https://www.binance.com/en/trade/${encodeURIComponent(symbol)}_USDT?type=spot`;
}

export function binanceSymbolUrl(symbol) {
  return `https://www.binance.com/en/trade/${encodeURIComponent(symbol)}_USDT`;
}

export function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyText(text) {
  if (!text) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function sharePage({ title, text, url }) {
  const shareUrl = url || window.location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: shareUrl });
      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        return false;
      }
    }
  }

  return copyText(shareUrl);
}
