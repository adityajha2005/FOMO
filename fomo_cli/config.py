"""Config: env vars first, then fomo_cli.cfg (INI) in repo root. All amounts in USD."""
import configparser
import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG_PATH = ROOT / "fomo_cli.cfg"

CHAIN_BY_NETWORK = {1399811149: "solana", 1: "ethereum", 56: "bsc", 8453: "base", 4663: "robinhood", 143: "monad"}


@dataclass
class Config:
    fomo_api_key: str = ""
    account_usd: float = 1000.0
    sizing: str = "conviction"  # fixed | kelly | conviction
    base_pct: float = 2.0  # % of account per trade before multipliers
    max_pct: float = 6.0  # hard cap per position
    min_usd: float = 10.0
    max_open: int = 6
    daily_loss_limit_pct: float = 8.0
    min_liquidity_usd: float = 20000.0
    max_liquidity_share_pct: float = 1.0  # never be >1% of pool liquidity
    max_top10_holders_pct: float = 45.0
    min_thesis_hitrate: float = 0.55
    chains: tuple = ("solana", "robinhood", "base", "bsc", "ethereum")
    poll_seconds: int = 20
    live: bool = False
    solana_private_key: str = ""
    solana_rpc: str = "https://api.mainnet-beta.solana.com"
    slippage_bps: int = 300
    cache_ttl_leaderboard: int = 600
    cache_ttl_trader: int = 24 * 3600
    cache_ttl_token: int = 3600  # keyed token stats/devs/theses checks
    data_dir: Path = field(default_factory=lambda: ROOT / "data")

    @classmethod
    def load(cls) -> "Config":
        c = cls()
        ini = configparser.ConfigParser(inline_comment_prefixes=(";", "#"))
        if CFG_PATH.exists():
            ini.read(CFG_PATH)
            sec = ini["fomo"] if "fomo" in ini else {}
            for f in cls.__dataclass_fields__:
                if f in sec:
                    setattr(c, f, _coerce(getattr(c, f), sec[f]))
        for f in cls.__dataclass_fields__:
            env = os.environ.get(f.upper())
            if env is not None:
                setattr(c, f, _coerce(getattr(c, f), env))
        c.data_dir = Path(c.data_dir)
        c.data_dir.mkdir(exist_ok=True)
        return c


def _coerce(current, raw):
    if isinstance(current, bool):
        return str(raw).lower() in ("1", "true", "yes", "on")
    if isinstance(current, int):
        return int(raw)
    if isinstance(current, float):
        return float(raw)
    if isinstance(current, tuple):
        return tuple(x.strip() for x in str(raw).split(",") if x.strip())
    return raw
