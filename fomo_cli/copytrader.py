"""The copy loop: follow set -> alerts -> gates -> size -> execute -> manage exits."""
import time

from .api import ApiError, chain_of, dex_pair
from .executor import ExecError
from .scoring import classify, thesis_rows, trade_conviction, trade_stats
from .sizing import EXIT_RULES, size_usd

CONFLUENCE_WINDOW_S = 30 * 60
TOP_OBS_DELAY_S = 3600  # measure price 1h after a followed buy to detect "marks local tops"
TOP_OBS_N = 5
TOP_OBS_AVG_PCT = -10.0


class CopyTrader:
    def __init__(self, cfg, api, store, executor, log=print):
        self.cfg, self.api, self.store, self.ex, self.log = cfg, api, store, executor, log
        self.scores = {}
        self.follow = {}
        self.recent_buys = {}  # address -> [(handle, ts)]

    # ---- traders ----
    def follow_set(self):
        """Top 30 overall + top 3 daily + top 5 weekly + top 10 monthly (keyless)."""
        out = {}
        for window, n in (("all", 30), ("24h", 3), ("7d", 5), ("30d", 10)):
            for t in self.api.leaderboard(window, n):
                e = out.setdefault(t["handle"], {**t, "windows": []})
                e["windows"].append(f"{window}#{t['rank']}")
        self.follow = out
        for h, e in out.items():
            self._check_wallet(h, e.get("wallets") or {})
        return out

    def _check_wallet(self, handle, wallets):
        st = self.store.trader(handle)
        prev = st.get("wallets")
        if prev and prev != wallets:
            self.store.update_trader(handle, wallets=wallets, paused="wallet changed")
            self.store.log("pause", f"{handle}: wallet changed {prev} -> {wallets}")
        elif not prev:
            self.store.update_trader(handle, wallets=wallets)

    def analyze(self, handle, entry=None, deep=True):
        """Score a trader. Costs ~6 credits with a key (trades 1 + theses 5), cached a day. Keyless = leaderboard only."""
        if handle in self.scores:
            return self.scores[handle]
        entry = entry or self.follow.get(handle) or next(
            (t for t in self.api.leaderboard("all", 100) if t["handle"] == handle), {"handle": handle}
        )
        trades, theses = [], []
        if deep and self.api.key:
            try:
                trades = self.api.trades(handle)
                theses = self.api.theses(handle)
            except ApiError as e:
                self.log(f"[warn] {handle}: {e}")
        rows = thesis_rows(theses)
        score = classify(entry, trade_stats(trades), rows)
        score["rows"] = rows
        score["windows"] = entry.get("windows", [])
        self.scores[handle] = score
        return score

    # ---- gates ----
    def token_safe(self, chain, address, network_id):
        pair = dex_pair(chain, address)
        if not pair or not pair["price"]:
            return None, "unpriceable"
        if pair["liquidity"] < self.cfg.min_liquidity_usd:
            return pair, f"liquidity ${pair['liquidity']:,.0f} < ${self.cfg.min_liquidity_usd:,.0f}"
        if self.api.key:
            try:
                st = self.api.token_stats(address, network_id)
                top10 = st.get("top10HoldersPercent")
                if top10 is not None and float(top10) > self.cfg.max_top10_holders_pct:
                    return pair, f"top10 holders {top10}%"
                for d in self.api.token_devs(address, network_id):
                    if d.get("isDev") and (d.get("realizedPnlUsd") or 0) > 0 and (d.get("valueUsd") or 0) == 0:
                        return pair, "deployer fully exited"
            except ApiError:
                pass  # out of credits etc: fall through to price-only checks
        return pair, None

    def has_support(self, handle, score, pair, address):
        """Tape, confluence, or a reliable thesis must back the buy. Returns reason string or None."""
        if pair["buys_5m"] > pair["sells_5m"] and pair["buys_1h"] >= pair["sells_1h"]:
            return "tape"
        others = {h for h, ts in self.recent_buys.get(address, []) if h != handle and time.time() - ts < CONFLUENCE_WINDOW_S}
        if others:
            return f"confluence ({', '.join(sorted(others))})"
        hr = score.get("hit_rate")
        if hr is not None and hr >= self.cfg.min_thesis_hitrate and self.api.key and score["style"] == "Holder":
            try:
                if self.api.token_theses(handle, address):
                    return f"thesis (hit-rate {hr:.0%})"
            except ApiError:
                pass
        return None

    def can_open(self):
        if len(self.store.open_positions()) >= self.cfg.max_open:
            return "max open positions"
        loss = -self.store.daily_pnl()
        if loss > self.cfg.account_usd * self.cfg.daily_loss_limit_pct / 100:
            return f"daily loss limit hit (-${loss:,.0f})"
        return None

    # ---- alerts ----
    def on_alert(self, a):
        handle = a.get("trader")
        if handle not in self.follow:
            return
        address, net = a.get("tokenAddress"), a.get("chainId")
        chain = chain_of(net, a.get("chain"))
        if a.get("type") == "sell":
            return self._on_followed_sell(handle, address)
        if a.get("type") != "buy" or not address:
            return
        self.recent_buys.setdefault(address, []).append((handle, time.time()))
        self._record_top_obs(handle, address, chain)
        st = self.store.trader(handle)
        if st.get("paused"):
            return self.log(f"skip {handle} {a.get('token')}: paused ({st['paused']})")
        if chain not in self.cfg.chains:
            return self.log(f"skip {handle} {a.get('token')}: chain {chain} off")
        if any(p["address"] == address for p in self.store.open_positions()):
            return
        block = self.can_open()
        if block:
            return self.log(f"skip {a.get('token')}: {block}")
        pair, unsafe = self.token_safe(chain, address, net)
        if unsafe:
            return self.log(f"skip {a.get('token')}: {unsafe}")
        score = self.analyze(handle)
        why = self.has_support(handle, score, pair, address)
        if not why:
            return self.log(f"skip {a.get('token')} from {handle}: no tape/confluence/thesis")
        conv = trade_conviction(a.get("usdValue"), score)
        usd, parts = size_usd(self.cfg, score, conv)
        usd = min(usd, pair["liquidity"] * self.cfg.max_liquidity_share_pct / 100)
        if usd < self.cfg.min_usd:
            return self.log(f"skip {a.get('token')}: size ${usd:.0f} below min")
        try:
            fill = self.ex.buy(chain, address, usd)
        except (ExecError, Exception) as e:  # noqa: BLE001 - never let one fill kill the loop
            return self.log(f"[error] buy {a.get('token')}: {e}")
        pid = self.store.open_position(
            handle=handle, token=a.get("token") or pair["symbol"], address=address, chain=chain, network_id=net,
            style=score["style"], entry_price=fill["price"], qty=fill["qty"], usd_in=fill["usd"],
            tx=fill.get("tx"), live=int(self.ex.name == "live"),
        )
        self.store.log("buy", f"#{pid} {a.get('token')} ${usd:.0f} copying {handle} ({score['style']}, {why}) {parts}")
        self.log(f"BUY #{pid} {a.get('token')} ${usd:.0f} @ {fill['price']:.6g} copying {handle} [{score['style']}, {why}]")

    def _on_followed_sell(self, handle, address):
        for p in self.store.open_positions():
            if p["address"] == address and p["handle"] == handle and EXIT_RULES[p["style"]]["follow_sell"]:
                self._close(p, "trader sold" if p["style"] != "Holder" else "thesis broke (trader sold)")

    def _record_top_obs(self, handle, address, chain):
        pair = dex_pair(chain, address)
        if not pair:
            return
        st = self.store.trader(handle)
        obs = st.get("obs", [])
        obs.append({"address": address, "chain": chain, "p0": pair["price"], "ts": time.time(), "ret": None})
        self.store.update_trader(handle, obs=obs[-20:])

    def _update_top_obs(self):
        for handle in self.follow:
            st = self.store.trader(handle)
            obs, changed = st.get("obs", []), False
            for o in obs:
                if o["ret"] is None and time.time() - o["ts"] > TOP_OBS_DELAY_S:
                    pair = dex_pair(o["chain"], o["address"])
                    if pair and o["p0"]:
                        o["ret"] = (pair["price"] / o["p0"] - 1) * 100
                        changed = True
            done = [o["ret"] for o in obs if o["ret"] is not None][-TOP_OBS_N:]
            if changed:
                self.store.update_trader(handle, obs=obs)
            if len(done) >= TOP_OBS_N and sum(done) / len(done) < TOP_OBS_AVG_PCT and not st.get("paused"):
                self.store.update_trader(handle, paused="buys mark local tops")
                self.store.log("pause", f"{handle}: last {TOP_OBS_N} buys avg {sum(done)/len(done):.1f}% after 1h")

    # ---- exits ----
    def manage_exits(self):
        for p in self.store.open_positions():
            rule = EXIT_RULES[p["style"]]
            pair = dex_pair(p["chain"], p["address"])
            if not pair or not pair["price"]:
                continue
            chg = (pair["price"] / p["entry_price"] - 1) * 100
            age_h = (time.time() - p["opened_at"]) / 3600
            if chg <= rule["stop_pct"]:
                self._close(p, f"stop {chg:.0f}%")
            elif rule["take_pct"] and chg >= rule["take_pct"]:
                self._close(p, f"take profit {chg:.0f}%")
            elif rule["scale_out_pct"] and chg >= rule["scale_out_pct"] and not p["scaled_out"]:
                self._scale_out(p, 0.5, f"scale out at +{chg:.0f}%")
            elif age_h >= rule["time_stop_h"]:
                self._close(p, f"time stop {age_h:.1f}h ({chg:+.0f}%)")

    def _close(self, p, reason):
        try:
            fill = self.ex.sell(p["chain"], p["address"], p["qty"])
        except Exception as e:  # noqa: BLE001
            return self.log(f"[error] sell #{p['id']} {p['token']}: {e}")
        pnl = fill["usd"] - p["usd_in"]
        self.store.close_position(p["id"], fill["price"], pnl, reason, fill.get("tx"))
        self.store.log("sell", f"#{p['id']} {p['token']} {reason} pnl ${pnl:+.2f}")
        self.log(f"SELL #{p['id']} {p['token']} {reason} pnl ${pnl:+.2f}")

    def _scale_out(self, p, frac, reason):
        try:
            fill = self.ex.sell(p["chain"], p["address"], p["qty"] * frac)
        except Exception as e:  # noqa: BLE001
            return self.log(f"[error] scale-out #{p['id']}: {e}")
        pnl = fill["usd"] - p["usd_in"] * frac
        self.store.scale_out(p["id"], p["qty"] * (1 - frac), p["usd_in"] * (1 - frac), pnl)
        self.store.log("scale", f"#{p['id']} {p['token']} {reason} pnl ${pnl:+.2f}")
        self.log(f"SCALE-OUT #{p['id']} {p['token']} {reason} pnl ${pnl:+.2f}")

    # ---- loop ----
    def tick(self):
        since = self.store.get("alerts_since") or int((time.time() - 300) * 1000)
        alerts = self.api.alerts(limit=100, since=since)
        for a in sorted(alerts, key=lambda x: x.get("ts", 0)):
            if a.get("ts", 0) > since:
                self.on_alert(a)
                since = a["ts"]
        self.store.set("alerts_since", since)
        self.manage_exits()
        self._update_top_obs()
        return len(alerts)

    def run(self, once=False):
        # ponytail: REST polling of /v2/alerts (keyless = 60s delayed). Swap for wss://api.fomoapi.io/ws/alerts once a key is in play.
        self.follow_set()
        self.log(f"following {len(self.follow)} traders, executor={self.ex.name}, sizing={self.cfg.sizing}, account=${self.cfg.account_usd:,.0f}")
        last_refresh = time.time()
        while True:
            try:
                n = self.tick()
                self.log(f"tick: {n} alerts, {len(self.store.open_positions())} open, day pnl ${self.store.daily_pnl():+.2f}, credits {self.api.credits_spent:g}")
            except (ApiError, OSError) as e:
                self.log(f"[warn] {e}")
            if once:
                return
            if time.time() - last_refresh > self.cfg.cache_ttl_leaderboard:
                self.follow_set()
                last_refresh = time.time()
            time.sleep(self.cfg.poll_seconds)
