import { Link } from "react-router-dom";
import InfoPageLayout, { DocSection, Note } from "../components/InfoPageLayout.jsx";

const TOC = [
  { id: "entry", label: "When we buy" },
  { id: "sizing", label: "How much" },
  { id: "caps", label: "Hard caps" },
  { id: "example", label: "unipcs example" },
  { id: "exits", label: "When we sell" },
  { id: "safeguards", label: "Safety rails" },
];

const ENTRY = [
  {
    n: "1",
    name: "Hype",
    when: "$100k+ notional in 5 minutes — usually a headline or viral tweet.",
    then: "Enter immediately. Controlled FOMO; liquidity already proved itself.",
  },
  {
    n: "2",
    name: "Confluence",
    when: "Volume still quiet, but 3 tracked wallets buy the same mint.",
    then: "Treat it as confirmation. Smart money stacking before the crowd.",
  },
  {
    n: "3",
    name: "Tape / thesis",
    when: "5m buys > sells, 1h buys ≥ sells — or a thesis from a Holder-tier wallet.",
    then: "Default quality gate. No entry on weak tape or random low-conviction alerts.",
  },
];

const VARS = [
  ["A", "Account size ($)", "account_usd"],
  ["b", "Base risk % per trade", "base_pct · default 2"],
  ["M", "Style multiplier", "Trencher 0.5 · Flipper 1.0 · Holder 1.5"],
  ["m", "Hard cap % of account", "max_pct · default 6"],
  ["L", "Pool liquidity ($)", "DexScreener"],
  ["R", "Trader risk 0–100", "scoring"],
  ["C", "Trader conviction 0–100", "scoring"],
  ["c", "Trade conviction 0.5–2", "alert size vs their median"],
  ["p", "Thesis hit-rate", "historical theses"],
];

const SIZING = [
  {
    name: "Fixed",
    cfg: "sizing = fixed",
    math: "S = A × (b/100) × M × (1 − R/200)",
    note: "Risk score 100 halves size. Simplest mode.",
  },
  {
    name: "Half-Kelly",
    cfg: "sizing = kelly",
    math: "f = ½ × max(0, (p*×B − (1−p*)) / B)\nS = A × f",
    note: "p* from thesis hit-rate (default 0.45). B = avg win / avg loss (default 1.5).",
  },
  {
    name: "Conviction",
    cfg: "sizing = conviction · default",
    math: "S = A × (b/100) × M × c × (0.5 + C/100) × H\nH = 0.5 + p  when p known, else 1",
    note: "Weights trader quality and this specific buy size.",
  },
];

const EXITS = [
  { style: "Trencher", time: "15m", stop: "−12%", tp: "+25%", scale: "—", follow: "Yes" },
  { style: "Flipper", time: "4h", stop: "−15%", tp: "+40%", scale: "50% @ +20%", follow: "Yes" },
  { style: "Holder", time: "48h", stop: "−20%", tp: "—", scale: "—", follow: "No" },
];

export default function FormulasPage() {
  return (
    <InfoPageLayout
      title="Formulas"
      subtitle="The actual gates, sizing math, and exit rules — the stuff the bot prints when it skips a trade."
      toc={TOC}
      related={[
        { label: "Docs", to: "/docs" },
        { label: "FOMO App", to: "/app" },
      ]}
      footer={
        <div className="docs-endcard docs-endcard--quote">
          <blockquote>
            Follow wallets that already win. Copy only when tape agrees. Never be the only bid in a thin
            pool.
          </blockquote>
          <Link to="/app">Open app →</Link>
        </div>
      }
    >
      <DocSection id="entry" title="When we buy" kicker="All paths need liquidity + holder checks first">
        <div className="formula-flow">
          {ENTRY.map((row) => (
            <article key={row.n} className="formula-flow__item">
              <span className="formula-flow__n">{row.n}</span>
              <div>
                <h3>{row.name}</h3>
                <p>
                  <strong>If</strong> {row.when}
                </p>
                <p>
                  <strong>Then</strong> {row.then}
                </p>
              </div>
            </article>
          ))}
        </div>
      </DocSection>

      <DocSection id="sizing" title="How much" kicker="Size from your account — not their bag size">
        <div className="doc-var-grid">
          {VARS.map(([sym, label, src]) => (
            <div key={sym} className="doc-var">
              <span className="doc-var__sym">{sym}</span>
              <div>
                <strong>{label}</strong>
                <span>{src}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="formula-stack">
          {SIZING.map((row) => (
            <article key={row.name} className="formula-stack__item">
              <header>
                <h3>{row.name}</h3>
                <code>{row.cfg}</code>
              </header>
              <pre className="formula-stack__math">{row.math}</pre>
              <p>{row.note}</p>
            </article>
          ))}
        </div>
      </DocSection>

      <DocSection id="caps" title="Hard caps">
        <pre className="formula-stack__math formula-stack__math--solo">
          {`S = min(S_formula, A × m/100, L × max_liquidity_share_pct/100)

if S < min_usd → skip`}
        </pre>
        <Note variant="tip">
          Default <code>max_liquidity_share_pct = 1</code> — you can't take more than 1% of the pool. Stops
          you from being exit liquidity for the wallet you copied.
        </Note>
      </DocSection>

      <DocSection id="example" title="unipcs example" kicker="$1,000 account · Holder · R=41 · C=97 · p=0.79">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Math</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>fixed</td>
              <td className="num">1000 × 0.02 × 1.5 × (1 − 0.205)</td>
              <td className="num doc-table__highlight">$23.85</td>
            </tr>
            <tr>
              <td>kelly</td>
              <td className="num">f = 0.325 → capped at 6%</td>
              <td className="num doc-table__highlight">$60.00</td>
            </tr>
            <tr>
              <td>conviction</td>
              <td className="num">1000 × 0.02 × 1.5 × 1 × 1.47 × 1.29</td>
              <td className="num doc-table__highlight">$56.87</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection id="exits" title="When we sell">
        <p className="doc-muted">We don't mirror every sell. Exit logic follows the source trader's style.</p>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Style</th>
              <th>Time</th>
              <th>Stop</th>
              <th>Target</th>
              <th>Scale</th>
              <th>Follow sell</th>
            </tr>
          </thead>
          <tbody>
            {EXITS.map((row) => (
              <tr key={row.style}>
                <td>
                  <span className={`doc-style doc-style--${row.style.toLowerCase()}`}>{row.style}</span>
                </td>
                <td className="num">{row.time}</td>
                <td className="num doc-negative">{row.stop}</td>
                <td className="num doc-positive">{row.tp}</td>
                <td className="num">{row.scale}</td>
                <td>{row.follow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>

      <DocSection id="safeguards" title="Safety rails">
        <ul className="doc-safeguards">
          <li>
            <strong>Dedicated wallet</strong> — paper or copy wallet only; never your main stack.
          </li>
          <li>
            <strong>Max 6 open coins</strong> — no spray-and-pray.
          </li>
          <li>
            <strong>−8% daily halt</strong> — bot stops for 24h after hitting the drawdown limit.
          </li>
          <li>
            <strong>Token filter</strong> — skips illiquid pools, heavy insider concentration, deployer dumps.
          </li>
          <li>
            <strong>Trader pause</strong> — wallet rotation or local-top behavior freezes that handle.
          </li>
        </ul>
      </DocSection>
    </InfoPageLayout>
  );
}
