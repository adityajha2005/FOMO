import { useMemo, useState } from "react";

/** STYLE_MULT from fomo_cli/sizing.py */
const STYLES = [
  { id: "Trencher", mult: 0.5, note: "in and out under 15 min" },
  { id: "Flipper", mult: 1.0, note: "minutes to hours" },
  { id: "Holder", mult: 1.5, note: "posts theses, holds" },
];

const BASE_PCT = 2;
const MAX_PCT = 6;
const MIN_USD = 10;
const PAYOFF = 1.5;

function money(value) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function SizingLab() {
  const [account, setAccount] = useState(1000);
  const [styleId, setStyleId] = useState("Holder");
  const [tradeConviction, setTradeConviction] = useState(1.35);
  const [traderConviction, setTraderConviction] = useState(78);
  const [hitRate, setHitRate] = useState(0.72);
  const [risk, setRisk] = useState(38);

  const style = STYLES.find((item) => item.id === styleId) ?? STYLES[1];

  const result = useMemo(() => {
    const cap = (account * MAX_PCT) / 100;

    const clamp = (raw) => {
      const capped = Math.min(raw, cap);
      return { raw, value: capped < MIN_USD ? 0 : capped, wasCapped: raw > cap, wasFloored: capped < MIN_USD };
    };

    // 1. fixed: A · b/100 · M · (1 − ½·R/100)
    const riskAdj = 1 - (risk / 100) * 0.5;
    const fixedRaw = (account * BASE_PCT) / 100 * style.mult * riskAdj;

    // 2. half-Kelly on hit-rate and payoff
    const f = Math.max(0, (hitRate * PAYOFF - (1 - hitRate)) / PAYOFF) * 0.5;
    const kellyRaw = account * f;

    // 3. conviction: A · b/100 · M · c · (0.5 + C/100) · H
    const traderMult = 0.5 + traderConviction / 100;
    const hitMult = 0.5 + hitRate;
    const convictionRaw = (account * BASE_PCT) / 100 * style.mult * tradeConviction * traderMult * hitMult;

    return {
      cap,
      riskAdj,
      halfKelly: f,
      traderMult,
      hitMult,
      fixed: clamp(fixedRaw),
      kelly: clamp(kellyRaw),
      conviction: clamp(convictionRaw),
    };
  }, [account, style.mult, tradeConviction, traderConviction, hitRate, risk]);

  const formulas = [
    {
      id: "conviction",
      name: "conviction",
      badge: "config default",
      expr: "S = A · b/100 · M · c · (0.5 + C/100) · H",
      substituted: `${account.toLocaleString("en-US")} × 2% × ${style.mult} × ${tradeConviction.toFixed(2)} × ${result.traderMult.toFixed(2)} × ${result.hitMult.toFixed(2)}`,
      out: result.conviction,
    },
    {
      id: "fixed",
      name: "fixed",
      expr: "S = A · b/100 · M · (1 − ½·R/100)",
      substituted: `${account.toLocaleString("en-US")} × 2% × ${style.mult} × ${result.riskAdj.toFixed(2)}`,
      out: result.fixed,
    },
    {
      id: "kelly",
      name: "half-kelly",
      expr: "f = ½ · max(0, (p·B − (1 − p)) / B) ,  S = A · f",
      substituted: `p ${hitRate.toFixed(2)} · B ${PAYOFF} → f ${result.halfKelly.toFixed(4)} × ${account.toLocaleString("en-US")}`,
      out: result.kelly,
    },
  ];

  return (
    <div className="fx-lab">
      <div className="fx-lab__controls">
        <p className="fx-mono fx-kicker">Inputs</p>

        <label className="fx-field">
          <span className="fx-mono">Account (A)</span>
          <input
            type="number"
            min="100"
            step="100"
            value={account}
            onChange={(event) => setAccount(Math.max(0, Number(event.target.value) || 0))}
            className="fx-mono"
          />
        </label>

        <div className="fx-field">
          <span className="fx-mono">Trader style (M)</span>
          <div className="fx-seg">
            {STYLES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === styleId ? "is-active" : undefined}
                onClick={() => setStyleId(item.id)}
                title={item.note}
              >
                {item.id}
                <em className="fx-mono">{item.mult}×</em>
              </button>
            ))}
          </div>
        </div>

        <label className="fx-field">
          <span className="fx-mono">
            Trade conviction (c) <b>{tradeConviction.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={tradeConviction}
            onChange={(event) => setTradeConviction(Number(event.target.value))}
          />
          <em className="fx-mono fx-field__hint">buy size ÷ their median — clamped 0.5…2</em>
        </label>

        <label className="fx-field">
          <span className="fx-mono">
            Trader conviction (C) <b>{traderConviction}</b>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={traderConviction}
            onChange={(event) => setTraderConviction(Number(event.target.value))}
          />
          <em className="fx-mono fx-field__hint">theses, hit-rate, pnl ÷ volume, style</em>
        </label>

        <label className="fx-field">
          <span className="fx-mono">
            Thesis hit-rate (p) <b>{hitRate.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={hitRate}
            onChange={(event) => setHitRate(Number(event.target.value))}
          />
          <em className="fx-mono fx-field__hint">gate 04 needs ≥ 0.55 for the thesis path</em>
        </label>

        <label className="fx-field">
          <span className="fx-mono">
            Risk (R) <b>{risk}</b>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={risk}
            onChange={(event) => setRisk(Number(event.target.value))}
          />
          <em className="fx-mono fx-field__hint">only the fixed formula reads this</em>
        </label>
      </div>

      <div className="fx-lab__out">
        <div className="fx-lab__caps fx-mono">
          <span>
            cap <b>{money(result.cap)}</b> <em>A × 6%</em>
          </span>
          <span>
            floor <b>{money(MIN_USD)}</b> <em>below this, skip</em>
          </span>
        </div>

        {formulas.map((formula) => (
          <article key={formula.id} className={`fx-formula${formula.badge ? " is-primary" : ""}`}>
            <header>
              <p className="fx-mono fx-formula__name">
                {formula.name}
                {formula.badge ? <em>{formula.badge}</em> : null}
              </p>
              <p className={`fx-formula__value fx-mono${formula.out.value === 0 ? " is-zero" : ""}`}>
                {formula.out.value === 0 ? "skipped" : money(formula.out.value)}
              </p>
            </header>

            <p className="fx-mono fx-formula__expr">{formula.expr}</p>
            <p className="fx-mono fx-formula__sub">
              {formula.substituted} = {money(formula.out.raw)}
            </p>

            {formula.out.wasCapped ? (
              <p className="fx-mono fx-formula__flag">clamped to the 6% cap</p>
            ) : null}
            {formula.out.wasFloored ? (
              <p className="fx-mono fx-formula__flag is-red">under $10 — entry skipped, not shrunk</p>
            ) : null}
          </article>
        ))}

        <p className="fx-lab__note">
          These are the functions in <code>fomo_cli/sizing.py</code>, not a marketing approximation. Change{" "}
          <code>sizing</code> in <code>fomo_cli.cfg</code> to pick which one runs the book.
        </p>
      </div>
    </div>
  );
}
