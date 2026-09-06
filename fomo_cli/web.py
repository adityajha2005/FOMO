"""JSON snapshots for the frontend copy-trader CLI."""
import time
import uuid

from .api import chain_of, dex_pair
from .config import Config
from .executor import ExecError, make_executor
from .store import Store


def _store():
    cfg = Config.load()
    return Store(cfg.data_dir / "fomo_cli.sqlite"), cfg


def _mark_prices(open_rows):
    prices = {}
    for row in open_rows:
        pair = dex_pair(row["chain"], row["address"])
        if pair and pair.get("price"):
            prices[row["id"]] = pair["price"]
    return prices


def _serialize_position(row, mark_price=None):
    entry = float(row["entry_price"] or 0)
    qty = float(row["qty"] or 0)
    usd_in = float(row["usd_in"] or 0)
    mark = mark_price if mark_price is not None else entry
    unrealized = None
    if row["status"] == "open":
        unrealized = qty * mark - usd_in
    return {
        "id": row["id"],
        "handle": row["handle"],
        "token": row["token"],
        "style": row["style"],
        "status": row["status"],
        "entry_price": entry,
        "exit_price": float(row["exit_price"]) if row["exit_price"] else None,
        "mark_price": mark_price,
        "qty": qty,
        "usd_in": usd_in,
        "pnl_usd": float(row["pnl_usd"] or 0),
        "unrealized_pnl": unrealized,
        "opened_at": row["opened_at"],
        "closed_at": row["closed_at"],
        "reason": row["reason"],
        "live": bool(row["live"]),
        "address": row["address"],
        "chain": row["chain"],
        "tx": row["tx"],
    }


def _serialize_event(row):
    return {
        "id": row["id"],
        "ts": row["ts"],
        "kind": row["kind"],
        "text": row["text"],
    }


def _token_safe(cfg, chain, address, network_id):
    pair = dex_pair(chain, address)
    if not pair or not pair["price"]:
        return None, "Token is not priceable right now"
    if pair["liquidity"] < cfg.min_liquidity_usd:
        return pair, f"Liquidity ${pair['liquidity']:,.0f} is below ${cfg.min_liquidity_usd:,.0f} minimum"
    return pair, None


def _can_open(store, cfg):
    if len(store.open_positions()) >= cfg.max_open:
        return "Maximum open positions reached"
    loss = -store.daily_pnl()
    if loss > cfg.account_usd * cfg.daily_loss_limit_pct / 100:
        return f"Daily loss limit hit (-${loss:,.0f})"
    return None


def manual_buy(token, address, usd, chain=None, network_id=None):
    store, cfg = _store()
    store.ensure_session()
    chain = chain or chain_of(network_id)
    if not chain:
        raise ValueError("Unknown chain — pass chain or network_id")
    if chain not in cfg.chains:
        raise ValueError(f"Chain {chain} is not enabled for trading")
    usd = float(usd)
    if usd < cfg.min_usd:
        raise ValueError(f"Minimum trade size is ${cfg.min_usd:.0f}")

    block = _can_open(store, cfg)
    if block:
        raise ValueError(block)

    pair, unsafe = _token_safe(cfg, chain, address, network_id)
    if unsafe:
        raise ValueError(unsafe)

    usd = min(usd, pair["liquidity"] * cfg.max_liquidity_share_pct / 100)
    executor = make_executor(cfg)
    try:
        fill = executor.buy(chain, address, usd)
    except ExecError as exc:
        raise ValueError(str(exc)) from exc

    tx = fill.get("tx") or f"paper-{uuid.uuid4().hex[:12]}"
    pid = store.open_position(
        handle="manual",
        token=token or pair["symbol"],
        address=address,
        chain=chain,
        network_id=network_id or 0,
        style="Manual",
        entry_price=fill["price"],
        qty=fill["qty"],
        usd_in=fill["usd"],
        tx=tx,
        live=int(executor.name == "live"),
        reason="manual buy",
    )
    summary = (
        f"#{pid} {token or pair['symbol']} ${fill['usd']:.2f} manual buy "
        f"@ {fill['price']:.6g} qty {fill['qty']:.4f} tx {tx}"
    )
    store.log("buy", summary)

    position = _serialize_position(store.get_position(pid), fill["price"])
    return {
        "ok": True,
        "side": "buy",
        "mode": executor.name,
        "position": position,
        "receipt": {
            "position_id": pid,
            "token": position["token"],
            "usd_paid": fill["usd"],
            "price": fill["price"],
            "qty": fill["qty"],
            "tx": tx,
            "chain": chain,
            "address": address,
            "timestamp": time.time(),
        },
    }


def manual_sell(token=None, address=None, position_id=None, usd=None):
    store, cfg = _store()
    executor = make_executor(cfg)

    if position_id:
        row = store.get_position(int(position_id))
    else:
        open_rows = store.open_positions()
        if address:
            open_rows = [p for p in open_rows if p["address"] == address]
        elif token:
            open_rows = [p for p in open_rows if p["token"].upper() == token.upper()]
        row = open_rows[-1] if open_rows else None

    if not row or row["status"] != "open":
        raise ValueError("No open position to sell")

    qty = float(row["qty"])
    usd_in = float(row["usd_in"])
    if usd:
        usd = float(usd)
        pair = dex_pair(row["chain"], row["address"])
        if not pair or not pair["price"]:
            raise ValueError("Cannot price token for partial sell")
        sell_qty = min(qty, usd / pair["price"])
        if sell_qty <= 0:
            raise ValueError("Sell amount too small")
        partial = sell_qty < qty * 0.999
    else:
        sell_qty = qty
        partial = False

    try:
        fill = executor.sell(row["chain"], row["address"], sell_qty)
    except ExecError as exc:
        raise ValueError(str(exc)) from exc

    tx = fill.get("tx") or f"paper-{uuid.uuid4().hex[:12]}"
    if partial:
        pnl = fill["usd"] - usd_in * (sell_qty / qty)
        store.scale_out(row["id"], qty - sell_qty, usd_in * (1 - sell_qty / qty), pnl)
        store.log("scale", f"#{row['id']} {row['token']} manual sell ${fill['usd']:.2f} pnl ${pnl:+.2f} tx {tx}")
        status = "partial"
    else:
        pnl = fill["usd"] - usd_in
        store.close_position(row["id"], fill["price"], pnl, "manual sell", tx)
        store.log("sell", f"#{row['id']} {row['token']} manual sell pnl ${pnl:+.2f} tx {tx}")
        status = "closed"

    position = _serialize_position(store.get_position(row["id"]), fill["price"])
    return {
        "ok": True,
        "side": "sell",
        "mode": executor.name,
        "status": status,
        "position": position,
        "receipt": {
            "position_id": row["id"],
            "token": row["token"],
            "usd_received": fill["usd"],
            "price": fill["price"],
            "qty": fill["qty"],
            "pnl_usd": pnl,
            "tx": tx,
            "chain": row["chain"],
            "address": row["address"],
            "timestamp": time.time(),
        },
    }


def snapshot(events_limit=40, positions_limit=20):
    store, cfg = _store()
    open_rows = store.open_positions()
    prices = _mark_prices(open_rows)
    stats = store.portfolio_stats(cfg.account_usd, prices)
    positions = [_serialize_position(row, prices.get(row["id"])) for row in open_rows]
    closed_rows = store.execute(
        "SELECT * FROM positions WHERE status='closed' ORDER BY id DESC LIMIT ?",
        (positions_limit,),
    ).fetchall()
    closed = [_serialize_position(dict(row)) for row in closed_rows]
    events = [_serialize_event(dict(row)) for row in reversed(store.events(limit=events_limit))]
    session_started = store.get("session_started")
    return {
        "mode": "live" if cfg.live else "paper",
        "account_usd": cfg.account_usd,
        "session_started": session_started,
        "updated_at": time.time(),
        "stats": stats,
        "open_positions": positions,
        "closed_positions": closed,
        "events": events,
    }
