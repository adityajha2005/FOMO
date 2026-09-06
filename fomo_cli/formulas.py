"""Human-readable formulas, shared by the dashboard (`f`), the `formulas` subcommand and the trader screen.
Keep in sync with scoring.py / sizing.py — the doc in docs/fomo_cli.md is the long form."""
from .sizing import EXIT_RULES, STYLE_MULT

FORMULAS_MD = (
    """
# How fomo-cli scores, sizes and exits

## Trader style
| median hold `h` | theses `T`, size ratio `r = median_size / $500` | style |
|---|---|---|
| unknown | `T ≥ 3` or `r > 4` | **Holder**, else **Flipper** |
| `h < 15 min` | — | **Trencher** — fast in and out |
| `15 min ≤ h < 6 h` | `T ≥ 5` and `r > 4` | **Holder**, else **Flipper** — minutes to hours |
| `h ≥ 6 h` | — | **Holder** — larger size, longer hold, posts theses |

## Thesis hit-rate
- `hit  =  realizedPnl + unrealizedPnl > 0` on the coin behind the thesis
- `p  =  hits / scored theses`   (theses without PnL are listed but not scored)

## Risk  (0–100, higher = riskier)
`R = 50 + 80·(0.5 − win_rate) + min(25, 5·σ_pnl / median_size) + 10·[trades < 50] + 10·[Trencher] − 30·(p − 0.5)`

## Conviction  (0–100)
`C = 40 + min(20, 2·T) + 40·(p − 0.5) + clamp(30·pnl / volume, −15, +15) + 10·[Holder]`

## Trade conviction  (per buy of `u` USD)
- `c = clamp(u / median_size, 0.5, 2)`   — a buy twice the trader's usual size doubles the copy

## Position size   (`A` = account, `b` = base %, `M` = style multiplier, `m` = max %)
style multiplier `M`: Trencher 0.5 · Flipper 1.0 · Holder 1.5

1. **fixed**   `S = A · b/100 · M · (1 − ½·R/100)`
2. **kelly**   `p* = p (else win_rate, else 0.45)`,  `B = avg_win / avg_loss (else 1.5)`,  `f = ½ · max(0, (p*·B − (1 − p*)) / B)`,  `S = A · f`
3. **conviction**   `S = A · b/100 · M · c · (0.5 + C/100) · H`,   `H = 0.5 + p  (1 if p unknown)`

Every formula is then capped:  `S = min(S, A·m/100, 1% of pool liquidity)`,  `S = 0 if S < min_usd`

## Entry gates  (all must pass)
trader not paused → chain enabled → not already held → open < max_open and 24h loss < limit
→ token priceable, liquidity ≥ floor, top-10 holders ≤ cap, deployer not fully exited
→ **support**: tape (5m buys > sells and 1h buys ≥ sells) **or** confluence (another followed trader bought within 30 min)
   **or** reliable thesis (Holder with `p ≥ 0.55` who wrote a thesis on the token)

## Exits by style
| style | time stop | stop | take | scale out | follows trader's sell |
|---|---|---|---|---|---|
"""
    + "\n".join(
        f"| {s} | {r['time_stop_h']:g} h | {r['stop_pct']}% | {('+%d%%' % r['take_pct']) if r['take_pct'] else '—'} | "
        f"{('50%% at +%d%%' % r['scale_out_pct']) if r['scale_out_pct'] else '—'} | {'yes' if r['follow_sell'] else 'no'} |"
        for s, r in EXIT_RULES.items()
    )
    + """

## Trader safeguards
pause on **wallet change**; pause when the last 5 followed buys average **< −10 % one hour later** (marks local tops)
"""
)


def explain_sizes(cfg, score, conv, sizes):
    """One line per formula with the trader's numbers substituted. sizes = all_sizes(...) output."""
    A, b, M, R, C = cfg.account_usd, cfg.base_pct, STYLE_MULT[score["style"]], score["risk"], score["conviction"]
    p = score.get("hit_rate")
    fx = sizes["fixed"][1]
    kl = sizes["kelly"][1]
    cv = sizes["conviction"][1]
    return {
        "fixed": f"{A:,.0f} × {b:g}% × {M} × (1 − ½·{R}/100) = {A * b / 100 * M * (1 - R / 200):,.2f}",
        "kelly": f"p*={kl['p']}, B={kl['payoff']} → f = ½·max(0, ({kl['p']}·{kl['payoff']} − {1 - kl['p']:.2f})/{kl['payoff']}) = {kl['half_kelly']} → {A:,.0f} × {kl['half_kelly']} = {A * kl['half_kelly']:,.2f}",
        "conviction": f"{A:,.0f} × {b:g}% × {M} × c {cv['trade_conviction']} × (0.5 + {C}/100) × H {cv['hitrate_mult']}"
        + (f" (p={p:.0%})" if p is not None else " (p unknown)")
        + f" = {A * b / 100 * M * conv * (0.5 + C / 100) * (1.0 if p is None else 0.5 + p):,.2f}",
        "cap": f"min(S, {A:,.0f} × {cfg.max_pct:g}% = {fx['cap']:,.0f}, 1% of pool liquidity);  0 if < ${cfg.min_usd:g}",
    }
