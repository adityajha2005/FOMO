"""Execution. Paper (default, all chains) and Jupiter live (Solana only).

Live path is gated on cfg.live + SOLANA_PRIVATE_KEY. It has been exercised only up to the quote step
against a real wallet: verify the first live trade with a tiny size.
"""
import base64
import json
import urllib.request

from .api import dex_pair, sol_price

SOL_MINT = "So11111111111111111111111111111111111111112"
JUP = "https://lite-api.jup.ag/swap/v1"


class ExecError(Exception):
    pass


class PaperExecutor:
    name = "paper"

    def buy(self, chain, address, usd):
        p = dex_pair(chain, address)
        if not p or not p["price"]:
            raise ExecError(f"no price for {address} on {chain}")
        return {"price": p["price"], "qty": usd / p["price"], "usd": usd, "tx": None}

    def sell(self, chain, address, qty):
        p = dex_pair(chain, address)
        if not p or not p["price"]:
            raise ExecError(f"no price for {address} on {chain}")
        return {"price": p["price"], "usd": qty * p["price"], "qty": qty, "tx": None}


class JupiterExecutor:
    """Solana via Jupiter. Buys spend SOL; sells go back to SOL."""

    name = "live"

    def __init__(self, cfg, paper_fallback=True):
        from solders.keypair import Keypair  # optional dep, imported lazily

        if not cfg.solana_private_key:
            raise ExecError("SOLANA_PRIVATE_KEY missing for live mode")
        self.kp = Keypair.from_base58_string(cfg.solana_private_key)
        self.rpc = cfg.solana_rpc
        self.slippage = cfg.slippage_bps
        self.paper = PaperExecutor() if paper_fallback else None

    # ---- helpers ----
    def _rpc(self, method, params):
        req = urllib.request.Request(
            self.rpc,
            data=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            out = json.loads(r.read())
        if "error" in out:
            raise ExecError(out["error"])
        return out["result"]

    def _post(self, url, body):
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())

    def quote(self, in_mint, out_mint, amount):
        q = f"{JUP}/quote?inputMint={in_mint}&outputMint={out_mint}&amount={int(amount)}&slippageBps={self.slippage}"
        with urllib.request.urlopen(q, timeout=20) as r:
            return json.loads(r.read())

    def _swap(self, quote):
        from solders.message import to_bytes_versioned
        from solders.transaction import VersionedTransaction

        body = {
            "quoteResponse": quote,
            "userPublicKey": str(self.kp.pubkey()),
            "wrapAndUnwrapSol": True,
            "dynamicComputeUnitLimit": True,
            "prioritizationFeeLamports": "auto",
        }
        raw = base64.b64decode(self._post(f"{JUP}/swap", body)["swapTransaction"])
        tx = VersionedTransaction.from_bytes(raw)
        sig = self.kp.sign_message(to_bytes_versioned(tx.message))
        signed = VersionedTransaction.populate(tx.message, [sig])
        return self._rpc(
            "sendTransaction",
            [base64.b64encode(bytes(signed)).decode(), {"encoding": "base64", "skipPreflight": False, "maxRetries": 3}],
        )

    def token_balance(self, mint):
        res = self._rpc("getTokenAccountsByOwner", [str(self.kp.pubkey()), {"mint": mint}, {"encoding": "jsonParsed"}])
        best = (0, 0)
        for acc in res.get("value", []):
            amt = acc["account"]["data"]["parsed"]["info"]["tokenAmount"]
            best = max(best, (int(amt["amount"]), int(amt["decimals"])))
        return best  # (raw_amount, decimals)

    # ---- interface ----
    def buy(self, chain, address, usd):
        if chain != "solana":
            if self.paper:
                return {**self.paper.buy(chain, address, usd), "note": "paper: live is Solana-only"}
            raise ExecError("live execution is Solana-only in v0")
        sol = sol_price()
        lamports = int(usd / sol * 1e9)
        q = self.quote(SOL_MINT, address, lamports)
        tx = self._swap(q)
        _, decimals = self.token_balance(address)
        qty = int(q["outAmount"]) / 10 ** (decimals or 6)
        return {"price": usd / qty if qty else 0, "qty": qty, "usd": usd, "tx": tx}

    def sell(self, chain, address, qty):
        if chain != "solana":
            if self.paper:
                return self.paper.sell(chain, address, qty)
            raise ExecError("live execution is Solana-only in v0")
        raw, decimals = self.token_balance(address)
        want = int(qty * 10**decimals)
        amount = min(raw, want) if want else raw
        if amount <= 0:
            raise ExecError("no token balance to sell")
        q = self.quote(address, SOL_MINT, amount)
        tx = self._swap(q)
        usd = int(q["outAmount"]) / 1e9 * sol_price()
        sold = amount / 10**decimals
        return {"price": usd / sold, "usd": usd, "qty": sold, "tx": tx}


def make_executor(cfg):
    return JupiterExecutor(cfg) if cfg.live else PaperExecutor()
