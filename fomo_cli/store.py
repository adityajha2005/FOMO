"""sqlite state: positions, per-trader state (wallet, pause, buy observations), event log."""
import json
import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY, handle TEXT, token TEXT, address TEXT, chain TEXT, network_id INTEGER,
  style TEXT, entry_price REAL, qty REAL, usd_in REAL, opened_at REAL, closed_at REAL,
  exit_price REAL, pnl_usd REAL DEFAULT 0, status TEXT DEFAULT 'open', scaled_out INTEGER DEFAULT 0,
  reason TEXT, tx TEXT, live INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS traders (handle TEXT PRIMARY KEY, data TEXT);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, ts REAL, kind TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
"""


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(str(path))
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)

    # ---- positions ----
    def open_position(self, **p):
        p.setdefault("opened_at", time.time())
        cols = ", ".join(p)
        cur = self.db.execute(f"INSERT INTO positions ({cols}) VALUES ({', '.join('?' * len(p))})", list(p.values()))
        self.db.commit()
        return cur.lastrowid

    def open_positions(self):
        return [dict(r) for r in self.db.execute("SELECT * FROM positions WHERE status='open' ORDER BY opened_at")]

    def positions(self, limit=50):
        return [dict(r) for r in self.db.execute("SELECT * FROM positions ORDER BY id DESC LIMIT ?", (limit,))]

    def get_position(self, pid):
        r = self.db.execute("SELECT * FROM positions WHERE id=?", (pid,)).fetchone()
        return dict(r) if r else None

    def close_position(self, pid, exit_price, pnl_usd, reason, tx=None):
        self.db.execute(
            "UPDATE positions SET status='closed', closed_at=?, exit_price=?, pnl_usd=pnl_usd+?, reason=?, tx=COALESCE(?, tx) WHERE id=?",
            (time.time(), exit_price, pnl_usd, reason, tx, pid),
        )
        self.db.commit()

    def scale_out(self, pid, qty_left, usd_left, pnl_usd):
        self.db.execute(
            "UPDATE positions SET qty=?, usd_in=?, pnl_usd=pnl_usd+?, scaled_out=1 WHERE id=?", (qty_left, usd_left, pnl_usd, pid)
        )
        self.db.commit()

    def daily_pnl(self):
        day = time.time() - 86400
        r = self.db.execute("SELECT COALESCE(SUM(pnl_usd),0) FROM positions WHERE closed_at > ? OR (scaled_out=1 AND opened_at > ?)", (day, day))
        return r.fetchone()[0]

    # ---- trader state ----
    def trader(self, handle):
        r = self.db.execute("SELECT data FROM traders WHERE handle=?", (handle,)).fetchone()
        return json.loads(r[0]) if r else {}

    def set_trader(self, handle, data):
        self.db.execute("INSERT OR REPLACE INTO traders VALUES (?, ?)", (handle, json.dumps(data)))
        self.db.commit()

    def update_trader(self, handle, **fields):
        d = self.trader(handle)
        d.update(fields)
        self.set_trader(handle, d)
        return d

    # ---- misc ----
    def log(self, kind, text):
        self.db.execute("INSERT INTO events (ts, kind, text) VALUES (?, ?, ?)", (time.time(), kind, text))
        self.db.commit()

    def events(self, limit=30):
        return [dict(r) for r in self.db.execute("SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,))]

    def get(self, k, default=None):
        r = self.db.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
        return json.loads(r[0]) if r else default

    def set(self, k, v):
        self.db.execute("INSERT OR REPLACE INTO kv VALUES (?, ?)", (k, json.dumps(v)))
        self.db.commit()
