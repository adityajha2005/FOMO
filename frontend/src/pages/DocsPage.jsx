import { Link } from "react-router-dom";
import InfoPageLayout, { CodeBlock, DocSection, Note } from "../components/InfoPageLayout.jsx";

const TOC = [
  { id: "what-this-is", label: "What this is" },
  { id: "setup", label: "Local setup" },
  { id: "manual", label: "Manual trades" },
  { id: "copy-bot", label: "Copy bot" },
  { id: "modes", label: "Paper vs live" },
  { id: "cli", label: "CLI cheatsheet" },
];

const SETUP = [
  {
    title: "Config",
    text: "Copy the example config and set account size. Add a FOMO API key if you want holders, stats, and faster alerts.",
    cmd: "cp fomo_cli.cfg.example fomo_cli.cfg",
  },
  {
    title: "Copy loop",
    text: "Paper mode by default. Watches leaderboard wallets and logs every skip, entry, and exit.",
    cmd: "python -m fomo_cli copy",
  },
  {
    title: "API server",
    text: "Feeds the dashboard trade panel and the live position strip.",
    cmd: "python -m binance_trade_bot.api_server",
  },
  {
    title: "Frontend",
    text: "Charts, leaderboard, manual buys. Set VITE_LIVE_API=true in frontend/.env.",
    cmd: "cd frontend && npm run dev",
  },
];

const CLI = [
  { cmd: "python -m fomo_cli stats", desc: "ROI, cash, open exposure" },
  { cmd: "python -m fomo_cli positions", desc: "What's still open" },
  { cmd: "python -m fomo_cli events", desc: "Every buy, sell, and skip reason" },
  { cmd: "python -m fomo_cli formulas", desc: "Same math as the Formulas page, in terminal" },
];

export default function DocsPage() {
  return (
    <InfoPageLayout
      title="Docs"
      subtitle="Run the stack locally, paper-trade from the UI, and let the bot copy wallets when the math says yes."
      toc={TOC}
      related={[
        { label: "Formulas", to: "/formulas" },
        { label: "FOMO App", to: "/app" },
      ]}
      footer={
        <div className="docs-endcard">
          <p>
            Stuck? Check the terminal running <code>fomo_cli copy</code> — skips print with the reason.
          </p>
          <Link to="/app">Back to app</Link>
        </div>
      }
    >
      <DocSection id="what-this-is" title="What this is">
        <p>
          A FOMO-style dashboard glued to a copy-trading engine. Prices and leaderboards come from live APIs;
          fills are simulated at real DexScreener quotes until you flip on live mode.
        </p>
        <dl className="doc-dl">
          <div>
            <dt>Dashboard</dt>
            <dd>Chart, leaderboard, manual buy/sell, copy-trader feed.</dd>
          </div>
          <div>
            <dt>Copy bot</dt>
            <dd>Follows ~30 leaderboard wallets. Enters on hype, confluence, or tape — not every alert.</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>FOMO API for traders and alerts. DexScreener for execution prices.</dd>
          </div>
        </dl>
      </DocSection>

      <DocSection id="setup" title="Local setup">
        <ol className="doc-steps">
          {SETUP.map((row) => (
            <li key={row.step}>
              <h3>{row.title}</h3>
              <p>{row.text}</p>
              <CodeBlock>{row.cmd}</CodeBlock>
            </li>
          ))}
        </ol>
      </DocSection>

      <DocSection id="manual" title="Manual trades">
        <p>
          Right panel on the dashboard. Minimum <strong>$10</strong>. Buy or sell, get a receipt with price
          and qty. Shows up in the copy-trader CLI a few seconds later — same paper ledger as the bot.
        </p>
        <Note variant="tip">
          Manual and auto trades share one sqlite file (<code>data/fomo_cli.sqlite</code>). ROI on the CLI
          includes both.
        </Note>
      </DocSection>

      <DocSection id="copy-bot" title="Copy bot">
        <p>
          The bot unions top traders from all-time, 24h, 7d, and 30d boards — roughly 30 wallets. It ignores
          most of their buys. Each entry needs safety checks plus one of{" "}
          <Link to="/formulas">three formulas</Link>.
        </p>
        <ul className="doc-list">
          <li>Hype — $100k+ volume in 5m (news/tweet candle)</li>
          <li>Confluence — 3 followed wallets buy the same coin while volume is still low</li>
          <li>Tape — buy pressure on 5m/1h chart, or a thesis from a Holder-class wallet</li>
        </ul>
        <p className="doc-muted">
          Exits depend on whether the source trader is classified Trencher, Flipper, or Holder. Safeguards
          cap open positions, daily loss, and pool liquidity share.
        </p>
      </DocSection>

      <DocSection id="modes" title="Paper vs live">
        <div className="doc-compare">
          <div className="doc-compare__col doc-compare__col--on">
            <h3>Paper</h3>
            <p className="doc-compare__tag">Default</p>
            <p>
              Simulated fills at live prices. No private key. Use this until you've watched a full session
              of skips and entries and trust the sizing.
            </p>
          </div>
          <div className="doc-compare__col">
            <h3>Live</h3>
            <p className="doc-compare__tag">Opt-in</p>
            <p>
              Set <code>live = true</code> and <code>SOLANA_PRIVATE_KEY</code> in <code>fomo_cli.cfg</code>.
              Routes through Jupiter on Solana. Start with a small <code>account_usd</code>.
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection id="cli" title="CLI cheatsheet">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {CLI.map((row) => (
              <tr key={row.cmd}>
                <td>
                  <code className="doc-inline-cmd">{row.cmd}</code>
                </td>
                <td>{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>
    </InfoPageLayout>
  );
}
