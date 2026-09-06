"""Trader classification: style (Trencher/Flipper/Holder), risk score, conviction, thesis hit-rate.

Payload shapes from FOMO vary by source (captured vs feed), so every field read is tolerant.
"""
import statistics
import time
from datetime import datetime

STYLES = ("Trencher", "Flipper", "Holder")
TRENCHER_MAX_H = 0.25  # < 15 minutes median hold
FLIPPER_MAX_H = 6.0  # minutes to hours; beyond that = Holder


def _num(d, *keys, default=None):
    for k in keys:
        v = d.get(k)
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return default


def _ts(d, *keys):
    for k in keys:
        v = d.get(k)
        if v is None:
            continue
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00")).timestamp()
            except ValueError:
                continue
        v = float(v)
        return v / 1000 if v > 1e11 else v  # ms -> s
    return None


def trade_stats(trades):
    pnls, sizes, holds = [], [], []
    for t in trades or []:
        closed = t.get("status", "closed") == "closed" or t.get("closedAt")
        pnl = _num(t, "realizedPnlUsd", "pnlUsd", "pnl", "realizedPnl") if closed else None
        size = _num(t, "sizeUsd", "usdValue", "tradeUsd", "buyUsd", "entryUsd", "costBasisUsd", "amountUsd")
        a = _ts(t, "entryTs", "openedAt", "firstBuyAt", "ts", "timestamp", "createdAt")
        b = _ts(t, "exitTs", "closedAt", "lastSellAt")
        if pnl is not None:
            pnls.append(pnl)
        if size:
            sizes.append(size)
        if a and b and b > a:
            holds.append(b - a)
    wins = [p for p in pnls if p > 0]
    losses = [-p for p in pnls if p < 0]
    return {
        "n": len(trades or []),
        "win_rate": len(wins) / len(pnls) if pnls else None,
        "avg_win": statistics.mean(wins) if wins else 0.0,
        "avg_loss": statistics.mean(losses) if losses else 0.0,
        "median_size": statistics.median(sizes) if sizes else None,
        "median_hold_s": statistics.median(holds) if holds else None,
        "pnl_std": statistics.pstdev(pnls) if len(pnls) > 1 else 0.0,
    }


def thesis_rows(theses):
    """One row per thesis; hit = the coin PnL behind it is positive (None if FOMO gave no PnL)."""
    rows = []
    for th in theses or []:
        realized = _num(th, "realizedPnlUsd", "realizedPnl", "pnlUsd", "pnl")
        unreal = _num(th, "unrealizedPnlUsd", "unrealizedPnl", default=0.0)
        pnl = None if realized is None and not unreal else (realized or 0.0) + (unreal or 0.0)
        tok = th.get("token") or {}
        rows.append(
            {
                "token": th.get("symbol") or th.get("tokenSymbol") or (tok.get("symbol") if isinstance(tok, dict) else tok) or "?",
                "address": th.get("tokenAddress") or th.get("address") or (tok.get("address") if isinstance(tok, dict) else None),
                "text": (th.get("text") or th.get("thesis") or "").strip(),
                "likes": int(_num(th, "likes", default=0)),
                "equity": _num(th, "equity", "equityUsd"),
                "pnl": pnl,
                "hit": None if pnl is None else pnl > 0,
                "ts": _ts(th, "ts", "timestamp", "createdAt"),
                "chain": th.get("chain"),
            }
        )
    return rows


def hit_rate(rows):
    scored = [r for r in rows if r["hit"] is not None]
    hits = sum(1 for r in scored if r["hit"])
    return hits, len(scored), (hits / len(scored) if scored else None)


def style_of(hold_h, thesis_count, size_ratio):
    """size_ratio = median trade size / typical FOMO size (~$500). Big size + theses pushes toward Holder."""
    if hold_h is None:
        return "Holder" if thesis_count >= 3 or size_ratio > 4 else "Flipper"
    if hold_h < TRENCHER_MAX_H:
        return "Trencher"
    if hold_h < FLIPPER_MAX_H:
        return "Holder" if thesis_count >= 5 and size_ratio > 4 else "Flipper"
    return "Holder"


def classify(entry, tstats, rows, profile=None):
    """entry = leaderboard row (keyless). tstats/rows may be empty when there's no API key."""
    profile = profile or {}
    trades_n = _num(entry, "trades", default=0) or _num(profile, "numTrades", default=0) or 0
    volume = _num(entry, "volumeUsd", default=0) or _num(profile, "totalVolume", default=0) or 0
    pnl = _num(entry, "pnlUsd", default=0) or 0
    avg_size = volume / trades_n if trades_n else 0.0
    median_size = tstats.get("median_size") or avg_size
    hold_s = tstats.get("median_hold_s") or _num(profile, "averageHoldTimeSeconds")
    hold_h = hold_s / 3600 if hold_s else None
    hits, scored, hr = hit_rate(rows)
    style = style_of(hold_h, len(rows), median_size / 500 if median_size else 0)

    # risk 0-100: low win-rate, fat pnl swings vs size, and low sample all raise it
    win = tstats.get("win_rate")
    risk = 50.0
    if win is not None:
        risk += (0.5 - win) * 80
    if median_size and tstats.get("pnl_std"):
        risk += min(25.0, tstats["pnl_std"] / median_size * 5)
    if trades_n < 50:
        risk += 10
    if style == "Trencher":
        risk += 10
    if hr is not None:
        risk -= (hr - 0.5) * 30
    risk = max(0.0, min(100.0, risk))

    # conviction 0-100: size relative to their volume, theses written, hold discipline, pnl efficiency
    conviction = 40.0
    conviction += min(20.0, len(rows) * 2)
    if hr is not None:
        conviction += (hr - 0.5) * 40
    if volume:
        conviction += max(-15.0, min(15.0, pnl / volume * 30))
    if style == "Holder":
        conviction += 10
    conviction = max(0.0, min(100.0, conviction))

    return {
        "handle": entry.get("handle") or profile.get("userHandle"),
        "style": style,
        "risk": round(risk),
        "conviction": round(conviction),
        "hit_rate": hr,
        "hits": hits,
        "scored": scored,
        "theses": len(rows),
        "hold_h": hold_h,
        "median_size": median_size,
        "avg_size": avg_size,
        "win_rate": win,
        "payoff": (tstats.get("avg_win") / tstats.get("avg_loss")) if tstats.get("avg_loss") else None,
        "trades": int(trades_n),
        "pnl": pnl,
        "volume": volume,
        "followers": int(_num(entry, "followers", default=0) or 0),
        "wallets": entry.get("wallets") or {},
        "sample_ok": bool(tstats.get("n")) or bool(rows),
    }


def trade_conviction(alert_usd, score):
    """0..2 multiplier for one buy: bigger than this trader's usual size = higher conviction."""
    base = score.get("median_size") or score.get("avg_size") or 0
    if not alert_usd or not base:
        return 1.0
    return max(0.5, min(2.0, alert_usd / base))


def describe(score):
    s = score["style"]
    lines = {
        "Trencher": "fast in and out; copies need a short time stop",
        "Flipper": "holds minutes to hours; scale out on strength",
        "Holder": "larger size, longer hold, usually posts a thesis",
    }[s]
    hr = score["hit_rate"]
    hr_txt = f"thesis hit-rate {hr:.0%} ({score['hits']}/{score['scored']})" if hr is not None else "no scored theses"
    return f"{s}: {lines}. Risk {score['risk']}/100, conviction {score['conviction']}/100, {hr_txt}."


def now():
    return time.time()
