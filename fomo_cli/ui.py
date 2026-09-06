"""rich renderers."""
import time

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

console = Console()

STYLE_COLOR = {"Trencher": "red", "Flipper": "yellow", "Holder": "green"}


def usd(v, sign=False):
    if v is None:
        return "-"
    s = f"{abs(v):,.0f}" if abs(v) >= 100 else f"{abs(v):,.2f}"
    if sign:
        return f"[green]+${s}[/]" if v >= 0 else f"[red]-${s}[/]"
    return f"${s}" if v >= 0 else f"-${s}"


def pct(v):
    return "-" if v is None else f"{v:.0%}"


def ago(ts):
    if not ts:
        return "-"
    d = time.time() - ts
    for unit, n in (("d", 86400), ("h", 3600), ("m", 60)):
        if d >= n:
            return f"{d / n:.0f}{unit}"
    return f"{d:.0f}s"


def leaderboard(rows, window, scores=None):
    t = Table(title=f"FOMO top {len(rows)} ({window})", expand=False)
    for c in ("#", "handle", "pnl", "volume", "trades", "avg size", "followers", "style", "risk", "hit%", "wallet"):
        t.add_column(c, justify="right" if c in ("#", "pnl", "volume", "trades", "avg size", "followers", "risk", "hit%") else "left")
    for r in rows:
        s = (scores or {}).get(r["handle"], {})
        style = s.get("style", "")
        w = (r.get("wallets") or {}).get("solana") or (r.get("wallets") or {}).get("evm") or ""
        t.add_row(
            str(r.get("rank")), r["handle"], usd(r.get("pnlUsd"), True), usd(r.get("volumeUsd")), str(r.get("trades", "")),
            usd(r["volumeUsd"] / r["trades"]) if r.get("trades") else "-", f"{r.get('followers', 0):,}",
            f"[{STYLE_COLOR.get(style, 'white')}]{style}[/]", str(s.get("risk", "")), pct(s.get("hit_rate")) if s else "",
            w[:6] + "…" if w else "",
        )
    console.print(t)


def trader(score, describe_text):
    style = score["style"]
    hold = f"{score['hold_h']:.1f}h" if score.get("hold_h") is not None else "unknown"
    body = (
        f"[bold {STYLE_COLOR[style]}]{style}[/]  risk [bold]{score['risk']}[/]/100  conviction [bold]{score['conviction']}[/]/100\n"
        f"{describe_text}\n\n"
        f"pnl {usd(score['pnl'], True)}  volume {usd(score['volume'])}  trades {score['trades']}  median size {usd(score.get('median_size'))}\n"
        f"median hold {hold}  win-rate {pct(score.get('win_rate'))}  payoff {score['payoff']:.2f}x  followers {score['followers']:,}\n"
        f"windows {', '.join(score.get('windows') or []) or '-'}\n"
        f"wallets sol={score['wallets'].get('solana', '-')} evm={score['wallets'].get('evm', '-')}"
        if score.get("payoff")
        else f"[bold {STYLE_COLOR[style]}]{style}[/]  risk [bold]{score['risk']}[/]/100  conviction [bold]{score['conviction']}[/]/100\n"
        f"{describe_text}\n\n"
        f"pnl {usd(score['pnl'], True)}  volume {usd(score['volume'])}  trades {score['trades']}  avg size {usd(score.get('avg_size'))}\n"
        f"median hold {hold}  followers {score['followers']:,}\n"
        f"windows {', '.join(score.get('windows') or []) or '-'}\n"
        f"wallets sol={score['wallets'].get('solana', '-')} evm={score['wallets'].get('evm', '-')}"
    )
    if not score.get("sample_ok"):
        body += "\n\n[dim]No trade/thesis data: set FOMO_API_KEY for hit-rate, hold time and win-rate (≈6 credits per trader, cached 24h).[/]"
    console.print(Panel(body, title=f"@{score['handle']}", expand=False))


def theses(rows, handle):
    t = Table(title=f"@{handle} theses ({len(rows)})", expand=True)
    t.add_column("when", width=5)
    t.add_column("token", width=10)
    t.add_column("hit", width=4, justify="center")
    t.add_column("pnl", width=10, justify="right")
    t.add_column("likes", width=5, justify="right")
    t.add_column("thesis")
    for r in sorted(rows, key=lambda x: x["ts"] or 0, reverse=True):
        hit = "-" if r["hit"] is None else ("[green]✓[/]" if r["hit"] else "[red]✗[/]")
        t.add_row(ago(r["ts"]), r["token"], hit, usd(r["pnl"], True) if r["pnl"] is not None else "-", str(r["likes"]), r["text"][:160])
    console.print(t)


def sizes(handle, score, all_sizes, chosen):
    t = Table(title=f"position size for copying @{handle} ({score['style']}, risk {score['risk']}, hit {pct(score['hit_rate'])})")
    t.add_column("formula")
    t.add_column("usd", justify="right")
    t.add_column("inputs")
    for name, (usd_v, parts) in all_sizes.items():
        mark = "[bold]*[/] " if name == chosen else "  "
        t.add_row(mark + name, usd(usd_v), ", ".join(f"{k}={v}" for k, v in parts.items()))
    console.print(t)


def positions(rows, prices=None):
    t = Table(title="positions", expand=False)
    for c in ("id", "status", "token", "chain", "copying", "style", "in", "entry", "now", "pnl", "age", "reason"):
        t.add_column(c, justify="right" if c in ("id", "in", "entry", "now", "pnl") else "left")
    for p in rows:
        now = (prices or {}).get(p["id"])
        if p["status"] == "open" and now:
            pnl = p["qty"] * now - p["usd_in"]
        else:
            pnl = p["pnl_usd"]
        t.add_row(
            str(p["id"]), p["status"], p["token"], p["chain"], p["handle"], p["style"], usd(p["usd_in"]),
            f"{p['entry_price']:.6g}", f"{now:.6g}" if now else "-", usd(pnl, True), ago(p["opened_at"]), p.get("reason") or "",
        )
    console.print(t)


def alert_line(a):
    side = "[green]BUY [/]" if a.get("type") == "buy" else "[red]SELL[/]" if a.get("type") == "sell" else "[cyan]THES[/]"
    size = f" ${a['usdValue']:,.0f}" if a.get("usdValue") else ""
    trader, token, chain = a.get("trader") or "?", a.get("token") or "?", a.get("chain") or ""
    return f"{ago((a.get('ts') or 0) / 1000):>4} {side} {trader:<18} {token:<12} {chain:<9}{size}"
