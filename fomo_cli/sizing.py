"""Three buying-size formulas + per-style exit rules. All return USD."""

STYLE_MULT = {"Trencher": 0.5, "Flipper": 1.0, "Holder": 1.5}

# how each style is exited (from the spec: trenchers time-stop, flippers scale out, holders stay until thesis breaks)
EXIT_RULES = {
    "Trencher": {"time_stop_h": 0.5, "stop_pct": -15, "take_pct": 40, "scale_out_pct": None, "follow_sell": True},
    "Flipper": {"time_stop_h": 24, "stop_pct": -25, "take_pct": None, "scale_out_pct": 50, "follow_sell": True},
    "Holder": {"time_stop_h": 14 * 24, "stop_pct": -35, "take_pct": None, "scale_out_pct": None, "follow_sell": True},
}


def fixed(cfg, score, conviction=1.0):
    """1. Fixed fraction: account x base% x style multiplier, shrunk by risk."""
    risk_adj = 1 - (score["risk"] / 100) * 0.5
    usd = cfg.account_usd * cfg.base_pct / 100 * STYLE_MULT[score["style"]] * risk_adj
    return usd, {"base%": cfg.base_pct, "style_mult": STYLE_MULT[score["style"]], "risk_adj": round(risk_adj, 2)}


def kelly(cfg, score, conviction=1.0):
    """2. Half-Kelly on thesis hit-rate (falls back to win-rate) and payoff ratio."""
    p = score.get("hit_rate") if score.get("hit_rate") is not None else score.get("win_rate")
    b = score.get("payoff") or 1.5
    if p is None:
        p = 0.45  # unknown edge -> conservative
    f = (p * b - (1 - p)) / b
    f = max(0.0, f) * 0.5
    usd = cfg.account_usd * f
    return usd, {"p": round(p, 2), "payoff": round(b, 2), "half_kelly": round(f, 4)}


def conviction_formula(cfg, score, conviction=1.0):
    """3. Conviction: base% x style x trade conviction (size vs their norm) x trader conviction x hit-rate."""
    hr = score.get("hit_rate")
    hr_mult = 1.0 if hr is None else 0.5 + hr  # 55% hit-rate -> 1.05x, 80% -> 1.3x
    trader_mult = 0.5 + score["conviction"] / 100  # 0.5..1.5
    usd = cfg.account_usd * cfg.base_pct / 100 * STYLE_MULT[score["style"]] * conviction * trader_mult * hr_mult
    return usd, {
        "base%": cfg.base_pct,
        "style_mult": STYLE_MULT[score["style"]],
        "trade_conviction": round(conviction, 2),
        "trader_mult": round(trader_mult, 2),
        "hitrate_mult": round(hr_mult, 2),
    }


FORMULAS = {"fixed": fixed, "kelly": kelly, "conviction": conviction_formula}


def size_usd(cfg, score, conviction=1.0, formula=None):
    fn = FORMULAS[formula or cfg.sizing]
    usd, parts = fn(cfg, score, conviction)
    cap = cfg.account_usd * cfg.max_pct / 100
    parts["cap"] = round(cap, 2)
    usd = min(usd, cap)
    if usd < cfg.min_usd:
        usd = 0.0
    return round(usd, 2), parts


def all_sizes(cfg, score, conviction=1.0):
    return {name: size_usd(cfg, score, conviction, name) for name in FORMULAS}
