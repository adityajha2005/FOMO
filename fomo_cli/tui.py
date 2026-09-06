"""Textual dashboard: leaderboard | live feed + positions, Enter on a trader for profile/theses/sizing, `c` runs the copy loop."""
import threading
import time

from rich.text import Text
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import DataTable, Footer, Header, Markdown, RichLog, Static

from .api import ApiError, dex_pair
from .formulas import FORMULAS_MD, explain_sizes
from .scoring import describe, trade_conviction
from .sizing import STYLE_MULT, all_sizes
from .ui import STYLE_COLOR, ago, pct

WINDOWS = ["all", "24h", "7d", "30d"]


def money(v, sign=False):
    if v is None:
        return "-"
    s = f"{abs(v):,.0f}" if abs(v) >= 100 else f"{abs(v):,.2f}"
    if sign:
        return Text(("+" if v >= 0 else "-") + "$" + s, style="green" if v >= 0 else "red")
    return f"${s}"


class FormulasScreen(Screen):
    BINDINGS = [Binding("escape,q,f", "app.pop_screen", "back")]

    def compose(self) -> ComposeResult:
        yield Header()
        yield Markdown(FORMULAS_MD, id="formulas")
        yield Footer()

    def on_mount(self):
        self.title = "fomo-cli — formulas"


class TraderScreen(Screen):
    BINDINGS = [Binding("escape,q", "app.pop_screen", "back"), Binding("f", "formulas", "formulas")]

    def action_formulas(self):
        self.app.push_screen(FormulasScreen())

    def __init__(self, app_state, handle):
        super().__init__()
        self.st, self.handle = app_state, handle

    def compose(self) -> ComposeResult:
        yield Header()
        yield Static("loading…", id="profile")
        yield DataTable(id="theses", zebra_stripes=True, cursor_type="row")
        yield Static("", id="sizes")
        yield Footer()

    def on_mount(self):
        self.title = f"@{self.handle}"
        t = self.query_one("#theses", DataTable)
        t.add_columns("when", "token", "hit", "pnl", "likes", "thesis")
        self.load()

    @work(thread=True)
    def load(self):
        try:
            self.st.bot.follow_set()
            s = self.st.bot.analyze(self.handle)
        except ApiError as e:
            self.app.call_from_thread(self.query_one("#profile", Static).update, f"[red]{e}[/]")
            return
        self.app.call_from_thread(self.render_score, s)

    def render_score(self, s):
        hold = f"{s['hold_h']:.1f}h" if s.get("hold_h") is not None else "?"
        w = s["wallets"]
        txt = (
            f"[bold {STYLE_COLOR[s['style']]}]{s['style']}[/]   risk [bold]{s['risk']}[/]/100   conviction [bold]{s['conviction']}[/]/100   "
            f"hit-rate [bold]{pct(s['hit_rate'])}[/] ({s['hits']}/{s['scored']})\n{describe(s)}\n"
            f"pnl {money(s['pnl'])}  volume {money(s['volume'])}  trades {s['trades']}  median size {money(s.get('median_size'))}  "
            f"hold {hold}  win-rate {pct(s.get('win_rate'))}  followers {s['followers']:,}  windows {', '.join(s.get('windows') or []) or '-'}\n"
            f"sol {w.get('solana', '-')}   evm {w.get('evm', '-')}"
        )
        self.query_one("#profile", Static).update(txt)
        t = self.query_one("#theses", DataTable)
        t.clear()
        for r in sorted(s["rows"], key=lambda x: x["ts"] or 0, reverse=True):
            hit = Text("-") if r["hit"] is None else Text("✓", style="green") if r["hit"] else Text("✗", style="red")
            t.add_row(
                ago(r["ts"]),
                r["token"],
                hit,
                money(r["pnl"], True) if r["pnl"] is not None else "-",
                str(r["likes"]),
                r["text"].replace("\n", " ")[:140],
            )
        if not s["rows"]:
            t.add_row(
                "", "", "", "", "", "no theses" if self.st.api.key else "set fomo_api_key in fomo_cli.cfg for theses"
            )
        self.score = s
        self.action_sizes()

    def action_sizes(self):
        s = getattr(self, "score", None)
        if not s:
            return
        conv = trade_conviction(s.get("median_size"), s)
        sizes = all_sizes(self.st.cfg, s, conv)
        eq = explain_sizes(self.st.cfg, s, conv, sizes)
        lines = [
            f"[bold]position size on ${self.st.cfg.account_usd:,.0f} account[/]  (▶ active: {self.st.cfg.sizing}, style mult {STYLE_MULT[s['style']]}, R {s['risk']}, C {s['conviction']})   [dim]f = all formulas[/]"
        ]
        for name, (usd, _) in sizes.items():
            mark = "▶" if name == self.st.cfg.sizing else " "
            lines.append(f"{mark} {name:<11} [bold]{money(usd):>8}[/]   [dim]{eq[name]}[/]")
        lines.append(f"  cap                    [dim]{eq['cap']}[/]")
        self.query_one("#sizes", Static).update("\n".join(lines))


class Dashboard(App):
    CSS = """
    #left { width: 58%; }
    #right { width: 42%; }
    #feed { height: 55%; border: round $primary; }
    #positions { height: 45%; border: round $secondary; }
    #board { border: round $accent; }
    #status { height: 1; background: $boost; }
    TraderScreen #profile { padding: 0 1; border: round $accent; height: auto; }
    TraderScreen #theses { height: 1fr; }
    TraderScreen #sizes { padding: 0 1; border: round $secondary; height: auto; }
    FormulasScreen #formulas { padding: 0 2; }
    """
    BINDINGS = [
        Binding("enter", "open", "open trader"),
        Binding("s", "score_all", "score all (credits)"),
        Binding("f", "formulas", "formulas"),
        Binding("w", "window", "window"),
        Binding("c", "copy", "start/stop copy loop"),
        Binding("r", "refresh", "refresh"),
        Binding("x", "close_pos", "close position"),
        Binding("q", "quit", "quit"),
    ]

    def __init__(self, app_state):
        super().__init__()
        self.st = app_state
        self.window_i = 0
        self.copying = False
        self.seen = set()

    def compose(self) -> ComposeResult:
        yield Header()
        with Horizontal():
            with Vertical(id="left"):
                yield DataTable(id="board", zebra_stripes=True, cursor_type="row")
            with Vertical(id="right"):
                yield RichLog(id="feed", markup=True, wrap=True)
                yield DataTable(id="positions", zebra_stripes=True, cursor_type="row")
        yield Static("", id="status")
        yield Footer()

    def on_mount(self):
        self.title = "fomo-cli"
        b = self.query_one("#board", DataTable)
        b.add_columns("#", "handle", "pnl", "volume", "trades", "avg", "style", "risk", "hit%")
        p = self.query_one("#positions", DataTable)
        p.add_columns("id", "token", "chain", "copying", "style", "in", "pnl", "age")
        b.focus()
        self.log_line("[dim]Enter opens a trader. c starts the paper copy loop. w cycles the leaderboard window.[/]")
        self.action_refresh()
        self.set_interval(self.st.cfg.poll_seconds, self.poll_feed)

    # ---- data ----
    @work(thread=True, exclusive=True, group="board")
    def load_board(self):
        window = WINDOWS[self.window_i]
        rows = self.st.api.leaderboard(window, 30)
        self.call_from_thread(self.fill_board, rows, window)

    def fill_board(self, rows, window):
        b = self.query_one("#board", DataTable)
        b.clear()
        for r in rows:
            s = self.st.bot.scores.get(r["handle"], {})
            style = s.get("style", "")
            b.add_row(
                str(r["rank"]),
                r["handle"],
                money(r.get("pnlUsd"), True),
                money(r.get("volumeUsd")),
                str(r.get("trades", "")),
                money(r["volumeUsd"] / r["trades"]) if r.get("trades") else "-",
                Text(style, style=STYLE_COLOR.get(style, "")),
                str(s.get("risk", "")),
                pct(s.get("hit_rate")) if s else "",
                key=r["handle"],
            )
        self.sub_title = f"leaderboard {window}"
        self.update_status()

    def fill_positions(self):
        p = self.query_one("#positions", DataTable)
        p.clear()
        for pos in self.st.store.open_positions():
            pair = dex_pair(pos["chain"], pos["address"])
            pnl = pos["qty"] * pair["price"] - pos["usd_in"] if pair and pair["price"] else None
            p.add_row(
                str(pos["id"]),
                pos["token"],
                pos["chain"],
                pos["handle"],
                pos["style"],
                money(pos["usd_in"]),
                money(pnl, True),
                ago(pos["opened_at"]),
                key=str(pos["id"]),
            )
        self.update_status()

    def update_status(self):
        loop = "[green]copy loop ON[/]" if self.copying else "[dim]copy loop off (c)[/]"
        n = len(self.st.store.open_positions())
        self.query_one("#status", Static).update(
            f" {loop}   executor {self.st.bot.ex.name}   account ${self.st.cfg.account_usd:,.0f}   sizing {self.st.cfg.sizing}   "
            f"open {n}/{self.st.cfg.max_open}   24h pnl {money(self.st.store.daily_pnl(), True).markup}   credits used {self.st.api.credits_spent:g}"
        )

    def log_line(self, text):
        self.query_one("#feed", RichLog).write(text)

    @work(thread=True, exclusive=True, group="feed")
    def poll_feed(self):
        if self.copying:
            return  # the copy loop already reads the feed
        try:
            alerts = self.st.api.alerts(limit=40)
        except (ApiError, OSError) as e:
            return self.call_from_thread(self.log_line, f"[red]{e}[/]")
        follow = self.st.bot.follow or {t["handle"] for t in self.st.api.leaderboard("all", 30)}
        for a in sorted(alerts, key=lambda x: x.get("ts", 0)):
            if a["id"] not in self.seen and a.get("trader") in follow:
                self.seen.add(a["id"])
                self.call_from_thread(self.log_line, self.alert_markup(a))

    @staticmethod
    def alert_markup(a):
        side = {"buy": "[green]BUY [/]", "sell": "[red]SELL[/]"}.get(a.get("type"), "[cyan]THES[/]")
        size = f" [bold]${a['usdValue']:,.0f}[/]" if a.get("usdValue") else ""
        return f"[dim]{ago((a.get('ts') or 0) / 1000):>4}[/] {side} [bold]{a.get('trader') or '?'}[/] {a.get('token') or '?'} [dim]{a.get('chain') or ''}[/]{size}"

    # ---- copy loop in a thread ----
    def copy_loop(self):
        bot = self.st.bot
        bot.log = lambda msg: self.call_from_thread(self.log_line, str(msg))
        try:
            bot.follow_set()
        except ApiError as e:
            return self.call_from_thread(self.log_line, f"[red]{e}[/]")
        while self.copying:
            try:
                bot.tick()
                self.call_from_thread(self.fill_positions)
            except (ApiError, OSError) as e:
                self.call_from_thread(self.log_line, f"[red]{e}[/]")
            for _ in range(self.st.cfg.poll_seconds):
                if not self.copying:
                    break
                time.sleep(1)

    # ---- actions ----
    def action_open(self):
        b = self.query_one("#board", DataTable)
        if b.row_count:
            self.push_screen(TraderScreen(self.st, b.get_row_at(b.cursor_row)[1]))

    def on_data_table_row_selected(self, ev):
        if ev.data_table.id == "board":
            self.push_screen(TraderScreen(self.st, str(ev.row_key.value)))

    @work(thread=True, exclusive=True, group="score")
    def action_score_all(self):
        b = self.query_one("#board", DataTable)
        handles = [str(k.value) for k in b.rows]
        todo = [h for h in handles if h not in self.st.bot.scores]
        cost = len(todo) * 6 if self.st.api.key else 0
        self.call_from_thread(self.log_line, f"[yellow]scoring {len(todo)} traders (~{cost} credits, cached 24h)…[/]")
        self.st.bot.follow_set()
        for h in todo:
            try:
                self.st.bot.analyze(h)
            except ApiError as e:
                self.call_from_thread(self.log_line, f"[red]{h}: {e}[/]")
                break
        self.call_from_thread(self.load_board)

    def action_formulas(self):
        self.push_screen(FormulasScreen())

    def action_window(self):
        self.window_i = (self.window_i + 1) % len(WINDOWS)
        self.load_board()

    def action_refresh(self):
        self.load_board()
        self.fill_positions()

    def action_copy(self):
        self.copying = not self.copying
        if self.copying:
            self.log_line(
                f"[green]copy loop started[/] ({self.st.bot.ex.name}, {self.st.cfg.sizing}, ${self.st.cfg.account_usd:,.0f})"
            )
            threading.Thread(target=self.copy_loop, daemon=True).start()
        else:
            self.log_line("[yellow]copy loop stopping[/]")
        self.update_status()

    def action_close_pos(self):
        p = self.query_one("#positions", DataTable)
        if p.has_focus and p.row_count:
            pos = self.st.store.get_position(int(p.get_row_at(p.cursor_row)[0]))
            if pos:
                self.st.bot._close(pos, "manual")
                self.fill_positions()

    def on_screen_resume(self):
        self.load_board()


def run_tui(app_state):
    Dashboard(app_state).run()
