# fomo-cli — Copy-trading FOMO.family leaders from the terminal

`fomo_cli` watches the FOMO.family leaderboard, scores each trader, and copies a buy only when the
trader's record and the market's tape justify it. It runs in paper mode by default and can execute live
on Solana through Jupiter.

Every number below is computed exactly as written in `fomo_cli/scoring.py`, `fomo_cli/sizing.py` and
`fomo_cli/copytrader.py`.

---

## 1. Quick start

```bash
cp fomo_cli.cfg.example fomo_cli.cfg   # account_usd, sizing, fomo_api_key (optional)
venv/bin/python -m fomo_cli            # dashboard
venv/bin/python -m fomo_cli --help     # scripting subcommands
venv/bin/python -m fomo_cli.test_smoke # self-check
```

| Dashboard key | Action |
|---|---|
| `↑` `↓` `Enter` | Open the highlighted trader: profile, every thesis with hit/miss, the three position sizes |
| `Esc` | Back to the board (the trader's style / risk / hit% fill into their row) |
| `s` | Score every trader on the board (≈6 credits each with a key, cached 24 h) |
| `w` | Cycle leaderboard window: all → 24h → 7d → 30d |
| `c` | Start / stop the copy loop inside the dashboard |
| `x` | Close the highlighted position at market |
| `q` | Quit |

Subcommands: `top`, `trader <handle>`, `theses <handle>`, `size <handle> [--usd N]`, `watch`,
`copy [--once] [--live]`, `positions [--all]`, `close <id>`, `events`, `me`, `shell`, `ui`.

---

## 2. Data sources

| Data | Endpoint | Key | Cost | Cache |
|---|---|---|---|---|
| Leaderboard (all / 24h / 7d / 30d) | `GET /v2/leaderboard/{window}` | no | free | 10 min |
| Activity feed (buys, sells, theses) | `GET /v2/alerts` | no | free, 60 s delayed | none |
| Trader trade history | `GET /v2/users/{handle}/trades` | yes | 1 | 24 h |
| Trader theses with PnL | `GET /v2/thesis/user/{handle}` | yes | 5 | 24 h |
| Trader's thesis on one token | `GET /v2/thesis/user/{h}/token/{addr}` | yes | 5 | 1 h |
| Token flow + holder concentration | `GET /v2/token/{addr}/stats` | yes | 1 | 1 h |
| Deployer / insider positions | `GET /v2/token/{addr}/devs` | yes | 1 | 1 h |
| Price, liquidity, tape, pair age | DexScreener `tokens/v1/{chain}/{addr}` | no | free | none |
| Swap quotes / execution (Solana) | Jupiter `lite-api.jup.ag/swap/v1` | no | free | none |

The API key is **never** sent to keyless endpoints, so polling costs nothing. With the free tier
(500 credits / month) the only spend is ≈6 credits per newly analysed trader per day and ≈2 credits per
new token the loop considers, once per hour.

Wallets come from the leaderboard payload and are the trader's verified on-chain wallets, not the app
profile address.

---

## 3. Trader classification

Let, for one trader:

| Symbol | Meaning | Source |
|---|---|---|
| $N$ | number of trades | leaderboard `trades` |
| $V$ | total volume, USD | leaderboard `volumeUsd` |
| $P$ | PnL, USD | leaderboard `pnlUsd` |
| $\bar{s}$ | average trade size $= V / N$ | derived |
| $\tilde{s}$ | median trade size, USD; falls back to $\bar{s}$ | trade history |
| $\tilde{h}$ | median hold time, hours, over closed trades (`closedAt − createdAt`) | trade history |
| $w$ | win rate over closed trades $= \#\{\text{pnl}>0\} / \#\{\text{closed}\}$ | trade history |
| $\sigma$ | population std-dev of closed-trade PnL | trade history |
| $T$ | number of theses written | theses |
| $p$ | thesis hit rate (§3.1) | theses |

### 3.1 Thesis hit rate

A thesis is scored when FOMO returns PnL for the coin behind it. It is a **hit** when

$$\text{realizedPnlUsd} + \text{unrealizedPnlUsd} > 0 .$$

$$p = \frac{\#\text{hits}}{\#\text{scored theses}}$$

Theses with no PnL data are listed but excluded from $p$. If no thesis is scored, $p$ is undefined and
every term that uses it is skipped.

### 3.2 Style

Size ratio $r = \tilde{s} / 500$ (500 USD ≈ a typical FOMO trade).

| Condition | Style |
|---|---|
| $\tilde{h}$ unknown and ($T \ge 3$ or $r > 4$) | **Holder** |
| $\tilde{h}$ unknown otherwise | **Flipper** |
| $\tilde{h} < 0.25$ h (15 min) | **Trencher** — fast in and out |
| $0.25 \le \tilde{h} < 6$ h and $T \ge 5$ and $r > 4$ | **Holder** |
| $0.25 \le \tilde{h} < 6$ h otherwise | **Flipper** — minutes to hours |
| $\tilde{h} \ge 6$ h | **Holder** — larger size, longer hold, usually posts a thesis |

### 3.3 Risk score (0–100, higher = riskier)

$$
R = \operatorname{clamp}_{[0,100]}\Big(
50
\;+\; 80\,(0.5 - w)
\;+\; \min\!\big(25,\ 5\,\sigma/\tilde{s}\big)
\;+\; 10\,[N < 50]
\;+\; 10\,[\text{Trencher}]
\;-\; 30\,(p - 0.5)
\Big)
$$

Each term is included only when its input is known. Low win rate, PnL swings that are large relative to
trade size, a small sample and Trencher behaviour raise risk; a thesis hit rate above 50 % lowers it.

### 3.4 Conviction score (0–100)

$$
C = \operatorname{clamp}_{[0,100]}\Big(
40
\;+\; \min(20,\ 2T)
\;+\; 40\,(p - 0.5)
\;+\; \operatorname{clamp}_{[-15,15]}\!\big(30\,P/V\big)
\;+\; 10\,[\text{Holder}]
\Big)
$$

Writing theses, a good hit rate, high PnL per dollar traded and Holder discipline raise conviction.

### 3.5 Trade conviction (per buy)

For an individual buy alert of size $u$ USD:

$$c = \operatorname{clamp}_{[0.5,\,2]}\big(u / \tilde{s}\big), \qquad c = 1 \text{ if } u \text{ or } \tilde{s} \text{ is unknown.}$$

A buy twice the trader's usual size doubles the copy; a half-size buy halves it.

---

## 4. Position sizing

Inputs common to all three formulas:

| Symbol | Meaning | Config |
|---|---|---|
| $A$ | your account size, USD | `account_usd` |
| $b$ | base risk per trade, % of account | `base_pct` (default 2) |
| $M$ | style multiplier: Trencher 0.5, Flipper 1.0, Holder 1.5 | fixed |
| $m$ | hard cap, % of account | `max_pct` (default 6) |
| $L$ | pool liquidity of the token, USD | DexScreener |

### 4.1 Formula 1 — Fixed fraction (`sizing = fixed`)

$$S_{\text{fixed}} = A \cdot \frac{b}{100} \cdot M \cdot \Big(1 - \tfrac{1}{2}\cdot\frac{R}{100}\Big)$$

A risk score of 0 keeps the full base size; a risk score of 100 halves it.

### 4.2 Formula 2 — Half-Kelly (`sizing = kelly`)

Edge probability and payoff:

$$p^\* = \begin{cases} p & \text{thesis hit rate known} \\ w & \text{else, win rate known} \\ 0.45 & \text{else (assume no edge)} \end{cases}
\qquad
B = \begin{cases} \overline{\text{win}} / \overline{\text{loss}} & \text{known} \\ 1.5 & \text{else} \end{cases}$$

Kelly fraction, halved for estimation error and floored at zero:

$$f = \tfrac{1}{2}\,\max\!\Big(0,\ \frac{p^\* B - (1 - p^\*)}{B}\Big), \qquad S_{\text{kelly}} = A \cdot f$$

### 4.3 Formula 3 — Conviction (`sizing = conviction`, default)

$$S_{\text{conv}} = A \cdot \frac{b}{100} \cdot M \cdot c \cdot \Big(0.5 + \frac{C}{100}\Big) \cdot H,
\qquad H = \begin{cases} 0.5 + p & p \text{ known} \\ 1 & \text{otherwise} \end{cases}$$

The trader-conviction factor ranges 0.5–1.5, the hit-rate factor $H$ ranges 0.5–1.5, and $c$ ranges 0.5–2.

### 4.4 Caps applied to every formula

$$S = \min\!\Big(S_{\text{formula}},\ A\cdot\frac{m}{100},\ L \cdot \frac{\texttt{max\_liquidity\_share\_pct}}{100}\Big), \qquad S = 0 \text{ if } S < \texttt{min\_usd}$$

The liquidity cap (default 1 % of the pool) is what stops the bot being the thin-market bid that pays the
trader it is copying.

Worked example (unipcs, 6 Sep 2026, $1 000 account, defaults): Holder, $R=41$, $C=97$, $p=0.79$ (15/19),
$c=1$.

| Formula | Computation | Size |
|---|---|---|
| fixed | $1000 \cdot 0.02 \cdot 1.5 \cdot (1 - 0.205)$ | $23.85 |
| kelly | $p^\*=0.79,\ B=1.5,\ f=\tfrac12 \cdot \frac{0.79\cdot1.5-0.21}{1.5}=0.325$; capped at 6 % | $60.00 |
| conviction | $1000 \cdot 0.02 \cdot 1.5 \cdot 1 \cdot 1.47 \cdot 1.29$ | $56.87 |

---

## 5. The copy loop

### 5.1 Follow set

Union of the top 30 all-time, top 3 daily (24h), top 5 weekly (7d) and top 10 monthly (30d) leaderboard
entries, refreshed every 10 minutes.

### 5.2 Entry pipeline

A buy alert from a followed trader is copied only if **every** gate passes, in this order:

1. **Trader not paused** (see §5.4).
2. **Chain enabled** (`chains`, default solana, robinhood, base, bsc, ethereum).
3. **Not already holding** the token.
4. **Book limits**: open positions $<$ `max_open`; 24 h realised loss $<$ `daily_loss_limit_pct` of $A$.
5. **Token safety**: priceable on DexScreener; $L \ge$ `min_liquidity_usd`; with a key, top-10 holder share
   $\le$ `max_top10_holders_pct` and the deployer has not fully exited at a profit.
6. **Support** — at least one of:
   * **Tape**: 5-minute buys $>$ sells **and** 1-hour buys $\ge$ sells on the best pair.
   * **Confluence**: another followed trader bought the same token within the last 30 minutes.
   * **Reliable thesis**: the trader is a Holder with $p \ge$ `min_thesis_hitrate` (default 0.55) and has
     written a thesis on this token.
7. **Size** $S$ from §4; skipped if $S = 0$.

### 5.3 Exit rules by style

| Style | Time stop | Stop loss | Take profit | Scale out | Follows trader's sell |
|---|---|---|---|---|---|
| Trencher | 30 min | −15 % | +40 % | — | yes |
| Flipper | 24 h | −25 % | — | 50 % of the position at +50 % | yes |
| Holder | 14 days | −35 % | — | — | yes (treated as "thesis broke") |

Exits are evaluated every tick against the DexScreener price. A followed trader's sell of a token you
copied from them closes the position immediately.

### 5.4 Trader safeguards

* **Wallet change** — the leaderboard wallet differs from the one stored on first sight → trader paused.
* **Marks local tops** — after every followed buy (copied or not) the price is sampled 1 hour later. When the
  last 5 samples average below −10 %, the trader is paused.
* Pauses are recorded in `data/fomo_cli.sqlite` (`traders` table) and shown in `events`.

### 5.5 Tick

Every `poll_seconds` (default 20): pull alerts since the last cursor → run §5.2 per buy, §5.3 sells →
manage exits → update top-marking samples. The cursor is persisted, so a restart does not replay alerts.

---

## 6. Execution

| Mode | Chains | Fill | Enable |
|---|---|---|---|
| `paper` (default) | all | DexScreener best-pair price, no slippage model | — |
| `live` | Solana only; other chains fall back to paper | Jupiter quote → swap → signed with your key → RPC `sendTransaction` | `live = true` + `solana_private_key`, or `copy --live` |

Live buys spend SOL; sells return to SOL. Slippage tolerance is `slippage_bps` (default 300). The live
path has been exercised up to the quote step only: start with a small `account_usd`.

---

## 7. Configuration reference (`fomo_cli.cfg`, section `[fomo]`; env vars in UPPERCASE override)

| Key | Default | Meaning |
|---|---|---|
| `fomo_api_key` | — | free key from fomoapi.io/dashboard |
| `account_usd` | 1000 | $A$ |
| `sizing` | conviction | `fixed` / `kelly` / `conviction` |
| `base_pct` | 2 | $b$ |
| `max_pct` | 6 | $m$ |
| `min_usd` | 10 | smallest position |
| `max_open` | 6 | max simultaneous positions |
| `daily_loss_limit_pct` | 8 | pause new buys after this realised 24 h loss |
| `min_liquidity_usd` | 20000 | token liquidity floor |
| `max_liquidity_share_pct` | 1 | position ≤ this % of pool liquidity |
| `max_top10_holders_pct` | 45 | holder-concentration cap (keyed) |
| `min_thesis_hitrate` | 0.55 | $p$ needed for the thesis gate |
| `chains` | solana,robinhood,base,bsc,ethereum | copyable chains |
| `poll_seconds` | 20 | tick interval |
| `live` | false | real execution |
| `solana_private_key` | — | base58 keypair (live only) |
| `solana_rpc` | mainnet-beta | RPC URL |
| `slippage_bps` | 300 | live slippage tolerance |
| `cache_ttl_leaderboard` | 600 | seconds |
| `cache_ttl_trader` | 86400 | seconds |
| `cache_ttl_token` | 3600 | seconds |

---

## 8. Files

| Path | Purpose |
|---|---|
| `fomo_cli/api.py` | FOMO + DexScreener clients, credit-aware cache |
| `fomo_cli/scoring.py` | §3 |
| `fomo_cli/sizing.py` | §4 and exit rules |
| `fomo_cli/copytrader.py` | §5 |
| `fomo_cli/executor.py` | §6 |
| `fomo_cli/store.py` | sqlite: positions, trader state, events, alert cursor |
| `fomo_cli/tui.py` | Textual dashboard |
| `fomo_cli/ui.py` | rich renderers for subcommands |
| `fomo_cli/__main__.py` | CLI entry |
| `fomo_cli/test_smoke.py` | self-check of scoring, sizing and the copy flow |
| `data/fomo_cli.sqlite` | your book (delete to reset paper trading) |
| `data/fomo_cache.sqlite` | API cache |

## 9. Known limits of v0

* Alerts are 60 s behind the app on the keyless feed. The `/ws/alerts` WebSocket (real-time on paid plans)
  is the upgrade path.
* Median hold time needs closed trades in the trader's recent history; when FOMO returns only open
  positions the style falls back to thesis count and size.
* Live execution is Solana-only. EVM chains (Robinhood, Base, BSC, Ethereum) are paper-only.
* Paper fills ignore slippage and fees.
