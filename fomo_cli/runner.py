"""Terminal auto-copy runner: live trades, positions, ROI on every tick."""
import time

from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table

from .api import dex_pair
from . import ui


class TerminalRunner:
    """Paper trading loop with rich terminal output (testnet-style simulation)."""

    def __init__(self, bot, cfg):
        self.bot = bot
        self.cfg = cfg

    def _mark_prices(self):
        prices = {}
        for p in self.bot.store.open_positions():
            pair = dex_pair(p["chain"], p["address"])
            if pair and pair.get("price"):
                prices[p["id"]] = pair["price"]
        return prices

    def _log_trade(self, message):
        ts = time.strftime("%H:%M:%S")
        if message.startswith("BUY"):
            ui.console.print(f"[bold green]{ts}[/] {message}")
        elif message.startswith("SELL") or message.startswith("SCALE"):
            color = "green" if "+$" in message and "-" not in message.split("pnl")[1][:3] else "red"
            ui.console.print(f"[bold {color}]{ts}[/] {message}")
        elif message.startswith("skip"):
            ui.console.print(f"[dim]{ts}[/] {message}")
        else:
            ui.console.print(f"[cyan]{ts}[/] {message}")

    def _print_dashboard(self):
        prices = self._mark_prices()
        stats = self.bot.store.portfolio_stats(self.cfg.account_usd, prices)
        open_rows = self.bot.store.open_positions()

        summary = Table.grid(padding=(0, 2))
        summary.add_column(style="bold")
        summary.add_column()
        summary.add_row("Account", ui.usd(self.cfg.account_usd))
        summary.add_row("Session", f"{stats['session_hours']:.1f}h")
        summary.add_row("Total PnL", ui.usd(stats["total_pnl"], True))
        summary.add_row("ROI", f"[bold]{stats['roi_pct']:+.2f}%[/]")
        summary.add_row("Realized", ui.usd(stats["realized_pnl"], True))
        summary.add_row("Unrealized", ui.usd(stats["unrealized_pnl"], True))
        summary.add_row("24h PnL", ui.usd(stats["day_pnl"], True))
        wr = ui.pct(stats["win_rate"]) if stats["win_rate"] is not None else "—"
        summary.add_row("Win rate", f"{wr} ({stats['wins']}W / {stats['losses']}L)")
        summary.add_row("Trades", f"{stats['closed_trades']} closed · {stats['open_count']} open")
        summary.add_row("Open value", ui.usd(stats["open_value"]))

        ui.console.print(Rule("[bold]Portfolio[/]"))
        ui.console.print(Panel(summary, title="Paper copy-trading (testnet mode)", border_style="dim"))
        if open_rows:
            ui.positions(open_rows, prices)
        else:
            ui.console.print("[dim]No open positions — waiting for entry signals…[/]")
        ui.console.print()

    def run(self, once=False):
        self.bot.store.ensure_session()
        self.bot.log = self._log_trade
        self.bot.follow_set()

        ui.console.print(
            Panel(
                "[bold]Auto copy-trader started[/]\n"
                "Mode: [green]paper[/] (simulated fills at DexScreener prices)\n\n"
                "[bold]Entry formulas:[/]\n"
                f"  1. Hype — ${self.cfg.hype_vol_5m_usd:,.0f}+ volume in 5 minutes\n"
                f"  2. Confluence — {self.cfg.confluence_min_wallets} tracked wallets, low volume\n"
                "  3. Tape / thesis — buy pressure or reliable holder thesis\n\n"
                f"Following [bold]{len(self.bot.follow)}[/] traders · "
                f"account ${self.cfg.account_usd:,.0f} · sizing={self.cfg.sizing}",
                border_style="green",
            )
        )

        last_dashboard = 0.0
        while True:
            try:
                self.bot.tick()
            except Exception as e:  # noqa: BLE001
                ui.console.print(f"[red][warn][/] {e}")

            now = time.time()
            if now - last_dashboard >= 30 or once:
                self._print_dashboard()
                last_dashboard = now

            if once:
                return

            time.sleep(self.cfg.poll_seconds)
