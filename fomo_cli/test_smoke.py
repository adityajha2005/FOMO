"""Smallest check that fails if scoring/sizing/copy logic breaks. Run: venv/bin/python -m fomo_cli.test_smoke
Uses a fake FOMO API (no credits) and real DexScreener prices (free)."""
import tempfile
import time
from pathlib import Path

from .config import Config
from .copytrader import CopyTrader
from .executor import PaperExecutor
from .scoring import classify, hit_rate, thesis_rows, trade_stats
from .sizing import all_sizes, size_usd
from .store import Store

PONS = "0x39dbed3a2bd333467115de45665cc57f813c4571"
NOW = time.time()
TRADES = [
    {
        "token": "A",
        "entryUsd": 1000,
        "realizedPnlUsd": 400,
        "openedAt": (NOW - 7200) * 1000,
        "closedAt": (NOW - 3600) * 1000,
    },
    {
        "token": "B",
        "entryUsd": 800,
        "realizedPnlUsd": -200,
        "openedAt": (NOW - 5000) * 1000,
        "closedAt": (NOW - 4000) * 1000,
    },
    {
        "token": "C",
        "entryUsd": 1200,
        "realizedPnlUsd": 900,
        "openedAt": (NOW - 90000) * 1000,
        "closedAt": (NOW - 1000) * 1000,
    },
]
THESES = [
    {"text": "A goes up", "symbol": "A", "likes": 12, "realizedPnlUsd": 400, "unrealizedPnlUsd": 0, "ts": NOW - 7000},
    {"text": "B goes up", "symbol": "B", "likes": 1, "realizedPnlUsd": -200, "ts": NOW - 5000},
    {"text": "no pnl yet", "symbol": "D", "likes": 3},
]
ENTRY = {
    "handle": "tester",
    "pnlUsd": 5000,
    "volumeUsd": 30000,
    "trades": 30,
    "followers": 10,
    "wallets": {"evm": "0x1"},
}


class FakeAPI:
    key = ""
    credits_spent = 0

    def leaderboard(self, window, limit):
        return [{**ENTRY, "rank": 1}]

    def alerts(self, **kw):
        return []


def test_scoring():
    rows = thesis_rows(THESES)
    assert hit_rate(rows) == (1, 2, 0.5), hit_rate(rows)
    ts = trade_stats(TRADES)
    assert ts["win_rate"] == 2 / 3 and ts["median_hold_s"] == 3600
    s = classify(ENTRY, ts, rows)
    assert s["style"] == "Flipper", s["style"]
    assert 0 <= s["risk"] <= 100 and 0 <= s["conviction"] <= 100
    return s


def test_sizing(score):
    cfg = Config(account_usd=1000, base_pct=2, max_pct=6)
    sizes = all_sizes(cfg, score)
    assert all(0 <= v <= 60 for v, _ in sizes.values()), sizes
    assert size_usd(cfg, score, conviction=2.0, formula="conviction")[0] > size_usd(cfg, score, 1.0, "conviction")[0]
    assert size_usd(cfg, {**score, "risk": 100}, 1.0, "fixed")[0] < size_usd(cfg, {**score, "risk": 0}, 1.0, "fixed")[0]


def test_copy_flow():
    cfg = Config(account_usd=1000, data_dir=Path(tempfile.mkdtemp()), chains=("robinhood",), min_liquidity_usd=1000)
    store = Store(cfg.data_dir / "t.sqlite")
    bot = CopyTrader(cfg, FakeAPI(), store, PaperExecutor(), log=lambda *a: None)
    bot.follow_set()
    assert "tester" in bot.follow
    bot.recent_buys[PONS] = [("w1", time.time()), ("w2", time.time())]  # 3 wallets after tester alert
    alert = {
        "type": "buy",
        "trader": "tester",
        "token": "PONS",
        "tokenAddress": PONS,
        "chainId": 4663,
        "chain": "robinhood",
        "usdValue": 2000,
    }
    bot.on_alert(alert)
    opened = store.open_positions()
    assert len(opened) == 1 and opened[0]["qty"] > 0, opened
    assert bot.can_open() is None
    bot.on_alert({**alert, "type": "sell"})  # trader sold -> follow_sell closes it
    assert not store.open_positions() and store.positions()[0]["status"] == "closed"
    # safeguard: wallet change pauses the trader
    bot._check_wallet("tester", {"evm": "0x2"})
    assert store.trader("tester")["paused"] == "wallet changed"


if __name__ == "__main__":
    s = test_scoring()
    test_sizing(s)
    test_copy_flow()
    print("ok")
