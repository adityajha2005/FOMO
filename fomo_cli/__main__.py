"""fomo-cli: terminal copy-trading on FOMO.family leaders.

  python -m fomo_cli top [--window all|24h|7d|30d] [--limit 30] [--score]
  python -m fomo_cli trader <handle>          profile, style, risk, conviction, thesis hit-rate
  python -m fomo_cli theses <handle>          every thesis with hit/miss
  python -m fomo_cli size <handle> [--usd N]  the 3 sizing formulas side by side
  python -m fomo_cli watch                    live alert feed from the follow set
  python -m fomo_cli copy [--once] [--live]   run the copy loop (paper unless --live)
  python -m fomo_cli positions | close <id> | events | me
  python -m fomo_cli shell                    interactive: same commands, no prefix
"""
import argparse
import cmd
import shlex
import sys

from .api import ApiError, FomoAPI, dex_pair
from .config import Config
from .copytrader import CopyTrader
from .executor import make_executor
from .scoring import describe, trade_conviction
from .sizing import all_sizes
from . import ui


class App:
    def __init__(self, cfg=None):
        self.cfg = cfg or Config.load()
        self.api = FomoAPI(self.cfg)
        from .store import Store

        self.store = Store(self.cfg.data_dir / "fomo_cli.sqlite")
        self.bot = CopyTrader(self.cfg, self.api, self.store, make_executor(self.cfg), log=ui.console.print)

    def top(self, window="all", limit=30, score=False):
        rows = self.api.leaderboard(window, limit)
        scores = {r["handle"]: self.bot.analyze(r["handle"], r) for r in rows} if score else None
        ui.leaderboard(rows, window, scores)
        if score and not self.api.key:
            ui.console.print("[dim]styles are estimated from leaderboard stats only; add FOMO_API_KEY for hit-rate/hold-time.[/]")

    def trader(self, handle):
        self.bot.follow_set()
        s = self.bot.analyze(handle)
        ui.trader(s, describe(s))
        if s["rows"]:
            ui.theses(s["rows"], handle)

    def theses(self, handle):
        s = self.bot.analyze(handle)
        if not s["rows"]:
            ui.console.print("no theses (need FOMO_API_KEY, or trader has none)")
        else:
            ui.theses(s["rows"], handle)

    def size(self, handle, usd=None):
        s = self.bot.analyze(handle)
        conv = trade_conviction(usd, s) if usd else 1.0
        ui.sizes(handle, s, all_sizes(self.cfg, s, conv), self.cfg.sizing)

    def watch(self, limit=40):
        import time

        self.bot.follow_set()
        seen = set()
        ui.console.print(f"watching {len(self.bot.follow)} traders (ctrl-c to stop)")
        while True:
            for a in sorted(self.api.alerts(limit=limit), key=lambda x: x.get("ts", 0)):
                if a["id"] not in seen and a.get("trader") in self.bot.follow:
                    seen.add(a["id"])
                    ui.console.print(ui.alert_line(a))
            time.sleep(self.cfg.poll_seconds)

    def copy(self, once=False, live=False):
        if live and not self.cfg.live:
            self.cfg.live = True
            self.bot.ex = make_executor(self.cfg)
        if self.cfg.live:
            ui.console.print("[bold red]LIVE MODE: real Solana swaps via Jupiter[/]")
        self.bot.run(once=once)

    def positions(self, all_=False):
        rows = self.store.positions() if all_ else self.store.open_positions()
        prices = {}
        for p in rows:
            if p["status"] == "open":
                pair = dex_pair(p["chain"], p["address"])
                if pair:
                    prices[p["id"]] = pair["price"]
        ui.positions(rows, prices)
        ui.console.print(f"24h realized pnl: {ui.usd(self.store.daily_pnl(), True)}")

    def close(self, pid):
        p = self.store.get_position(int(pid))
        if not p or p["status"] != "open":
            return ui.console.print("no such open position")
        self.bot._close(p, "manual")

    def events(self):
        for e in reversed(self.store.events()):
            ui.console.print(f"[dim]{ui.ago(e['ts']):>4}[/] {e['kind']:<6} {e['text']}")

    def me(self):
        ui.console.print(self.api.me() if self.api.key else "no FOMO_API_KEY set")


class Shell(cmd.Cmd):
    intro = "fomo-cli. commands: top trader theses size watch copy positions close events me quit"
    prompt = "fomo> "

    def __init__(self, app):
        super().__init__()
        self.app = app

    def default(self, line):
        if line in ("quit", "exit", "EOF"):
            return True
        try:
            run(shlex.split(line), self.app)
        except SystemExit:
            pass
        except (ApiError, ValueError, KeyError) as e:
            ui.console.print(f"[red]{e}[/]")
        except KeyboardInterrupt:
            ui.console.print()
        return False


def parser():
    p = argparse.ArgumentParser(prog="fomo_cli", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("top")
    s.add_argument("--window", default="all", choices=["all", "24h", "7d", "30d"])
    s.add_argument("--limit", type=int, default=30)
    s.add_argument("--score", action="store_true", help="classify each trader (costs credits with a key)")
    sub.add_parser("trader").add_argument("handle")
    sub.add_parser("theses").add_argument("handle")
    s = sub.add_parser("size")
    s.add_argument("handle")
    s.add_argument("--usd", type=float, help="the trader's buy size, for trade conviction")
    sub.add_parser("watch")
    s = sub.add_parser("copy")
    s.add_argument("--once", action="store_true")
    s.add_argument("--live", action="store_true")
    sub.add_parser("positions").add_argument("--all", action="store_true")
    sub.add_parser("close").add_argument("id")
    sub.add_parser("events")
    sub.add_parser("me")
    sub.add_parser("shell")
    return p


def run(argv, app):
    a = parser().parse_args(argv)
    if a.cmd == "top":
        app.top(a.window, a.limit, a.score)
    elif a.cmd == "trader":
        app.trader(a.handle.lstrip("@"))
    elif a.cmd == "theses":
        app.theses(a.handle.lstrip("@"))
    elif a.cmd == "size":
        app.size(a.handle.lstrip("@"), a.usd)
    elif a.cmd == "watch":
        app.watch()
    elif a.cmd == "copy":
        app.copy(a.once, a.live)
    elif a.cmd == "positions":
        app.positions(a.all)
    elif a.cmd == "close":
        app.close(a.id)
    elif a.cmd == "events":
        app.events()
    elif a.cmd == "me":
        app.me()
    elif a.cmd == "shell":
        Shell(app).cmdloop()


def main():
    app = App()
    try:
        run(sys.argv[1:] or ["shell"], app)
    except ApiError as e:
        ui.console.print(f"[red]{e}[/]")
        sys.exit(1)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
