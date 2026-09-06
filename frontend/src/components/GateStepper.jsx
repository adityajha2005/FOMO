import { useState } from "react";

/** Mirrors the entry gates in fomo_cli/formulas.py — order matters, all must pass. */
const GATES = [
  {
    id: "trader",
    step: "01",
    kind: "State",
    title: "Trader is eligible",
    rule: "not paused · chain enabled · not already held",
    body: "A wallet is paused on a wallet change, or when its last five followed buys average worse than −10% an hour later. That second rule is what stops the loop from buying local tops from someone on a hot streak.",
    rejects: "paused wallet · duplicate position · chain switched off in config",
  },
  {
    id: "book",
    step: "02",
    kind: "Account",
    title: "The book has room",
    rule: "open < max_open (6) · 24h loss < limit (8%)",
    body: "Portfolio-level checks run before anything about the token is fetched. If six positions are already open, or the day is down more than the loss limit, the pass ends here and nothing is priced.",
    rejects: "6 positions open · daily stop already hit",
  },
  {
    id: "token",
    step: "03",
    kind: "Token",
    title: "The token survives inspection",
    rule: "priceable · liquidity ≥ $20,000 · top-10 ≤ 45% · deployer not fully exited",
    body: "Liquidity floor, holder concentration, and a deployer check. Size is separately capped at 1% of pool liquidity, so a thin pool shrinks the entry instead of taking the whole book with it.",
    rejects: "no quote · thin pool · 61% held by ten wallets · deployer sold out",
  },
  {
    id: "support",
    step: "04",
    kind: "Signal",
    title: "One of three supports fires",
    rule: "tape · confluence · reliable thesis",
    body: "This is the only gate with alternatives, and exactly one is enough. Tape means 5m buys > sells and 1h buys ≥ sells. Confluence means another followed wallet bought the same mint within 30 minutes. Thesis means a Holder-tier wallet with hit-rate ≥ 0.55 wrote one on this token.",
    rejects: "flat tape, no second wallet, no thesis — the usual outcome",
  },
];

export default function GateStepper() {
  const [activeId, setActiveId] = useState(GATES[3].id);
  const active = GATES.find((gate) => gate.id === activeId) ?? GATES[0];

  return (
    <div className="fx-gates">
      <div className="fx-gates__list" role="tablist" aria-label="Entry gates">
        {GATES.map((gate) => (
          <button
            key={gate.id}
            type="button"
            role="tab"
            aria-selected={gate.id === activeId}
            className={gate.id === activeId ? "fx-gate is-active" : "fx-gate"}
            onClick={() => setActiveId(gate.id)}
          >
            <span className="fx-mono fx-gate__step">{gate.step}</span>
            <span className="fx-gate__text">
              <strong>{gate.title}</strong>
              <em className="fx-mono">{gate.rule}</em>
            </span>
          </button>
        ))}
      </div>

      <div className="fx-gates__detail" role="tabpanel">
        <p className="fx-mono fx-kicker">
          Gate {active.step} — {active.kind}
        </p>
        <h3>{active.title}</h3>
        <p className="fx-gates__body">{active.body}</p>

        <dl className="fx-gates__meta">
          <div>
            <dt className="fx-mono">Passes when</dt>
            <dd className="fx-mono fx-green">{active.rule}</dd>
          </div>
          <div>
            <dt className="fx-mono">Rejected for</dt>
            <dd className="fx-mono fx-red">{active.rejects}</dd>
          </div>
        </dl>

        <p className="fx-gates__foot">
          Every rejection is printed with its reason before the next wallet is read. The skip log is the
          product — it is how you audit a night where nothing was bought.
        </p>
      </div>
    </div>
  );
}
