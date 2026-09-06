"""FOMO API + DexScreener clients. stdlib urllib, sqlitedict disk cache so credits aren't burned twice."""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from sqlitedict import SqliteDict

from .config import CHAIN_BY_NETWORK, Config

FOMO = "https://api.fomoapi.io"
DEX = "https://api.dexscreener.com"

# credit cost per endpoint prefix, from GET /v1 (used only for the session counter)
COSTS = [("/v2/users/id/", 10), ("/v2/thesis", 5), ("/v2/alerts", 0.5)]
# free without a key; sending the key here would bill them (alerts 0.5/poll adds up to thousands a day)
KEYLESS = ("/v2/leaderboard/", "/v2/alerts", "/v1", "/health")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(f"{status}: {message}")
        self.status = status


def _http_json(url, headers=None, timeout=20):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "fomo-cli/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            msg = json.loads(body).get("message") or json.loads(body).get("error") or body
        except json.JSONDecodeError:
            msg = body[:200]
        raise ApiError(e.code, msg) from None


class FomoAPI:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.key = cfg.fomo_api_key
        self.cache = SqliteDict(str(cfg.data_dir / "fomo_cache.sqlite"), autocommit=True)
        self.credits_spent = 0.0

    # ---- core ----
    def get(self, path, params=None, ttl=0):
        params = {k: v for k, v in (params or {}).items() if v is not None}
        url = f"{FOMO}{path}" + (f"?{urllib.parse.urlencode(params)}" if params else "")
        if ttl:
            hit = self.cache.get(url)
            if hit and time.time() - hit["t"] < ttl:
                return hit["d"]
        headers = {"User-Agent": "fomo-cli/0.1"}
        keyed = bool(self.key) and not path.startswith(KEYLESS)
        if keyed:
            headers["Authorization"] = f"Bearer {self.key}"
        data = _http_json(url, headers)
        if keyed:
            self.credits_spent += next((c for p, c in COSTS if path.startswith(p)), 1)
        if ttl:
            self.cache[url] = {"t": time.time(), "d": data}
        return data

    # ---- keyless ----
    def leaderboard(self, window="all", limit=30):
        return self.get(f"/v2/leaderboard/{window}", {"limit": limit}, ttl=self.cfg.cache_ttl_leaderboard).get("traders", [])

    def alerts(self, limit=50, since=None, type_=None):
        return self.get("/v2/alerts", {"limit": limit, "since": since, "type": type_}).get("alerts", [])

    # ---- keyed (cached a day; these cost credits) ----
    def user(self, handle):  # 10 credits
        return self.get(f"/v2/users/{handle}", ttl=self.cfg.cache_ttl_trader)

    def trades(self, handle, limit=200):
        d = self.get(f"/v2/users/{handle}/trades", {"limit": limit}, ttl=self.cfg.cache_ttl_trader)
        return d.get("trades") or d.get("items") or (d if isinstance(d, list) else [])

    def theses(self, handle, limit=100, sort="recent"):  # 5 credits
        d = self.get(f"/v2/thesis/user/{handle}", {"limit": limit, "sort": sort}, ttl=self.cfg.cache_ttl_trader)
        return d.get("theses") or d.get("items") or []

    def token_theses(self, handle, address):
        d = self.get(f"/v2/thesis/user/{handle}/token/{address}", ttl=self.cfg.cache_ttl_token)
        return d.get("theses") or d.get("items") or []

    def token_stats(self, address, network_id=None):
        return self.get(f"/v2/token/{address}/stats", {"networkId": network_id}, ttl=self.cfg.cache_ttl_token)

    def token_devs(self, address, network_id=None):
        d = self.get(f"/v2/token/{address}/devs", {"networkId": network_id}, ttl=self.cfg.cache_ttl_token)
        return d.get("devs") or d.get("holders") or d.get("items") or []

    def me(self):
        return self.get("/v2/me")


# ---- prices (free, all FOMO chains) ----
def chain_of(network_id, chain_name=None):
    return chain_name or CHAIN_BY_NETWORK.get(int(network_id or 0))


def dex_pair(chain, address):
    """Best pair for token on chain: price, liquidity, age, tape. None if unpriceable."""
    try:
        pairs = _http_json(f"{DEX}/tokens/v1/{chain}/{address}")
    except (ApiError, urllib.error.URLError, json.JSONDecodeError):
        return None
    if not pairs:
        return None
    p = max(pairs, key=lambda x: (x.get("liquidity") or {}).get("usd") or 0)
    tx = p.get("txns") or {}
    return {
        "symbol": p["baseToken"]["symbol"],
        "price": float(p.get("priceUsd") or 0),
        "liquidity": float((p.get("liquidity") or {}).get("usd") or 0),
        "fdv": float(p.get("fdv") or 0),
        "age_h": (time.time() * 1000 - (p.get("pairCreatedAt") or time.time() * 1000)) / 3.6e6,
        "buys_5m": (tx.get("m5") or {}).get("buys", 0),
        "sells_5m": (tx.get("m5") or {}).get("sells", 0),
        "buys_1h": (tx.get("h1") or {}).get("buys", 0),
        "sells_1h": (tx.get("h1") or {}).get("sells", 0),
        "vol_1h": float((p.get("volume") or {}).get("h1") or 0),
        "url": p.get("url"),
    }


def sol_price():
    p = dex_pair("solana", "So11111111111111111111111111111111111111112")
    return p["price"] if p else 0.0
