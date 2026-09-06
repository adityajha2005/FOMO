import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GateStepper from "../components/GateStepper.jsx";
import HeroTerminal from "../components/HeroTerminal.jsx";
import PipelineDiagram from "../components/PipelineDiagram.jsx";
import SizingLab from "../components/SizingLab.jsx";
import { LIVE_API_ENABLED } from "../config/api.js";
import { useCopyTrader } from "../hooks/useCopyTrader.js";
import { useFomoAlerts } from "../hooks/useFomoAlerts.js";
import { getBookTraders } from "../services/fomoApi.js";
import { formatCompactUsd } from "../utils/format.js";
import { fomoTraderUrl } from "../utils/links.js";
import "./LandingPage.css";

const REPO_URL = "https://github.com/Adi101-coder/FOMO";
const FOLLOW_SET_SIZE = 30;
const SCAN_SECONDS = 20;

const WINDOWS = [
  { id: "24h", label: "24H" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "all", label: "ALL" },
];

const MANUAL_VS_LOOP = [
  { manual: "Wallet funded and connected, all day", loop: "One config file, read once at boot" },
  { manual: "Notifications on, screen open, or you miss it", loop: "A 20-second tick that never blinks" },
  { manual: "You fill after they do, at a worse price", loop: "Sized and filled on the same pass as the signal" },
  { manual: "Every exit is a decision you have to make", loop: "Exits are rules, re-checked on every tick" },
  { manual: "Position sizing drifts with your mood", loop: "2% base, 6% ceiling, clamped in code" },
  { manual: "A bad night compounds because you chase", loop: "8% daily stop halts entries before you do" },
];

const RAILS = [
  {
    label: "Daily stop",
    value: "8%",
    body: "Once the day is down 8% of the account, gate 02 stops passing. Open positions are still managed to their exit rules — the loop stops adding, not stops working.",
  },
  {
    label: "Max open",
    value: "6",
    body: "Six concurrent positions. The seventh signal is skipped with a reason rather than queued, so exposure can never quietly stack past what the sizer priced.",
  },
  {
    label: "Liquidity floor",
    value: "$20k",
    body: "Below this the token never gets priced. Above it, the entry is separately capped at 1% of pool liquidity, so a thin pool shrinks the trade instead of the trade moving the pool.",
  },
  {
    label: "Holder cap",
    value: "45%",
    body: "If the top ten wallets hold more than 45% of supply, it fails gate 03. A deployer that has fully exited fails it too, regardless of how good the tape looks.",
  },
  {
    label: "Thesis bar",
    value: "0.55",
    body: "The thesis path only opens for a Holder-tier wallet whose scored theses come in above 0.55. Below that the wallet still trades — it just can't carry an entry on conviction alone.",
  },
  {
    label: "Wallet pause",
    value: "−10%",
    body: "If a wallet's last five followed buys average worse than −10% an hour later, it is paused. That is the rule that catches someone reliably marking local tops.",
  },
];

const EXITS = [
  {
    style: "Trencher",
    mult: "0.5×",
    time: "30 min",
    stop: "−15%",
    take: "+40%",
    scale: "—",
    body: "In and out under fifteen minutes. Sized at half, stopped tight, and time-stopped fast — the edge decays before the hour does.",
  },
  {
    style: "Flipper",
    mult: "1.0×",
    time: "24 h",
    stop: "−25%",
    take: "—",
    scale: "50% at +50%",
    body: "The default register. Full size, a day of rope, and half the position off the table at +50% so the rest can run without the entry being at risk.",
  },
  {
    style: "Holder",
    mult: "1.5×",
    time: "14 d",
    stop: "−35%",
    take: "—",
    scale: "—",
    body: "Sized up, held longest, widest stop. These are the wallets that post a thesis, so the position lives until the thesis breaks or the trader sells.",
  },
];

const MODES = [
  {
    mode: "Paper",
    state: "default",
    tone: "green",
    points: [
      "Fills simulated at live DexScreener quotes",
      "No key, no signer, no broadcast path in the process",
      "Full ledger: positions, marks, events, skip reasons",
      "Costs nothing and can be reset by deleting one file",
    ],
  },
  {
    mode: "Live",
    state: "off until you enable it",
    tone: "amber",
    points: [
      "Needs live = true plus a Solana key you supply",
      "Slippage capped at 300 bps in the config",
      "Same gates, same sizer, same exits — nothing changes",
      "We ship it off. Turning it on is your decision, not a default",
    ],
  },
];

const TRUST = [
  {
    label: "Nothing to withdraw from",
    body: "Paper mode holds no key, no signer, and no allowance. There is no owner, no admin flag, and no timelock — because there is no custody. The only thing on disk is a SQLite ledger of marks.",
  },
  {
    label: "The caps are not suggestions",
    body: "The sizer clamps every result to max_pct before returning. There is no code path that lifts it at runtime, so the worst a bad score can do is spend 6% of a paper account.",
  },
  {
    label: "Recomputable, not claimable",
    body: "Scores come from public leaderboard data and marks come from public quotes. You can recompute any number on this page yourself, which is why we don't ask you to trust the ones we print.",
  },
];

const FUNCTIONS = [
  {
    name: "analyze()",
    file: "copytrader.py",
    body: "Scores a wallet from leaderboard stats and thesis history. Reads only. It cannot open, size, or spend — it returns a number and a style.",
  },
  {
    name: "size_usd()",
    file: "sizing.py",
    body: "Turns a score into dollars, then clamps to the config cap and the liquidity share. Returns 0 below the floor. It never returns more than max_pct.",
  },
  {
    name: "close()",
    file: "copytrader.py",
    body: "Sells on target, stop, stall, or when the trader sells. Only the loop calls it. It moves a position to closed and writes the reason next to it.",
  },
];

const CLI = [
  { cmd: "python -m fomo_cli copy", desc: "Run the loop. Paper unless you pass --live." },
  { cmd: "python -m fomo_cli top --score", desc: "The follow set with style, risk, and conviction attached." },
  { cmd: "python -m fomo_cli trader <handle>", desc: "One wallet: style, risk, thesis hit-rate, hold time." },
  { cmd: "python -m fomo_cli size <handle> --usd 500", desc: "All three sizing formulas, side by side, with the math shown." },
  { cmd: "python -m fomo_cli positions", desc: "What is open right now, with live marks." },
  { cmd: "python -m fomo_cli events", desc: "Every entry, exit, and skip — with the reason." },
  { cmd: "python -m fomo_cli formulas", desc: "The same math as the Formulas page, in the terminal." },
  { cmd: "python -m binance_trade_bot.api_server", desc: "Serve the snapshot the dashboard and this page read." },
];

const CONFIG_FACTS = [
  [
    { label: "Data layer", value: "fomoapi.io — leaderboard, alerts, holders, thesis" },
    { label: "Chains read", value: "solana · base · bsc · ethereum · robinhood" },
    { label: "Scan interval", value: "poll_seconds = 20" },
  ],
  [
    { label: "Sizing", value: "conviction · base 2% · max 6% · min $10" },
    { label: "Exposure", value: "max_open 6 · daily_loss_limit_pct 8" },
    { label: "Token gates", value: "liquidity ≥ $20k · top-10 ≤ 45% · share ≤ 1%" },
  ],
  [
    { label: "Ledger", value: "data/fomo_cli.sqlite", mono: true },
    { label: "Execution", value: "live = false · slippage_bps = 300" },
    { label: "Secrets", value: "fomo_cli.cfg and frontend/.env, both gitignored" },
  ],
];

function shortWallet(wallet) {
  if (!wallet) {
    return null;
  }
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function explorerUrl(row) {
  if (!row.wallet) {
    return fomoTraderUrl(row.handle);
  }
  return row.walletIsSolana
    ? `https://solscan.io/account/${row.wallet}`
    : `https://etherscan.io/address/${row.wallet}`;
}

/** Alert timestamps arrive as either seconds or milliseconds. */
function age(ts) {
  const raw = Number(ts) || 0;
  const ms = raw > 1e12 ? raw : raw * 1000;
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

function alertSide(alert) {
  const raw = String(alert.side || alert.alertType || alert.action || alert.type || "").toLowerCase();
  return raw.includes("sell") ? "sell" : "buy";
}

function useScanCountdown() {
  const [left, setLeft] = useState(SCAN_SECONDS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLeft((value) => (value <= 1 ? SCAN_SECONDS : value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return String(left).padStart(2, "0");
}

function Avatar({ row }) {
  const [failed, setFailed] = useState(false);

  if (row.avatarUrl && !failed) {
    return (
      <img
        className="fx-row__avatar"
        src={row.avatarUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className="fx-row__avatar fx-row__avatar--fallback">{row.initials}</span>;
}

function SectionHead({ n, kicker, title, lede, aside }) {
  return (
    <header className="fx-head">
      <div>
        <p className="fx-mono fx-kicker">
          <span className="fx-kicker__n">{n}</span>
          {kicker}
        </p>
        <h2>{title}</h2>
        {lede ? <p className="fx-lede">{lede}</p> : null}
      </div>
      {aside ? <div className="fx-head__aside">{aside}</div> : null}
    </header>
  );
}

export default function LandingPage() {
  const [windowId, setWindowId] = useState("24h");
  const [sortBy, setSortBy] = useState("pnl");
  const [book, setBook] = useState([]);
  const [bookError, setBookError] = useState(null);
  const [bookLoading, setBookLoading] = useState(LIVE_API_ENABLED);
  const [showAll, setShowAll] = useState(false);

  const countdown = useScanCountdown();
  const { data: bot, error: botError } = useCopyTrader();
  const { alerts, connected: streaming } = useFomoAlerts({ enabled: LIVE_API_ENABLED });

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      setBookLoading(false);
      return undefined;
    }

    let active = true;
    setBookLoading(true);

    getBookTraders({ window: windowId, limit: 100 })
      .then((rows) => {
        if (active) {
          setBook(rows);
          setBookError(null);
        }
      })
      .catch((error) => {
        if (active) {
          setBook([]);
          setBookError(error.message || "Could not reach the leaderboard");
        }
      })
      .finally(() => {
        if (active) {
          setBookLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [windowId]);

  const rows = useMemo(() => {
    const sorted = [...book];
    if (sortBy === "vol") {
      sorted.sort((a, b) => b.volumeRaw - a.volumeRaw);
    }
    if (sortBy === "followers") {
      sorted.sort((a, b) => b.followers - a.followers);
    }
    return sorted;
  }, [book, sortBy]);

  const visibleRows = showAll ? rows : rows.slice(0, 20);
  const stats = bot.stats;
  const marquee = book.slice(0, 14);

  return (
    <div className="fx">
      <header className="fx-nav">
        <div className="fx-nav__inner">
          <Link className="fx-brand" to="/">
            <span className="fx-brand__mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="fx-brand__text">
              fomo<b>copy</b>
            </span>
          </Link>

          <nav className="fx-nav__links" aria-label="Main">
            <Link to="/app">Terminal</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/formulas">Formulas</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source
            </a>
          </nav>

          <div className="fx-nav__right">
            <span className="fx-mono fx-chip">
              <i className={bot.mode === "live" ? "is-amber" : "is-green"} />
              {bot.mode === "live" ? "live" : "paper"}
            </span>
            <span className="fx-mono fx-nav__stat">
              {formatCompactUsd(bot.account_usd || 0)} acct
            </span>
            <span className="fx-mono fx-nav__stat">{stats?.open_count ?? 0}/6 open</span>
            <span className="fx-mono fx-nav__stat fx-hide-sm">
              next scan {countdown}s
            </span>
            <Link className="fx-btn fx-btn--sm" to="/app">
              Open terminal
            </Link>
          </div>
        </div>
      </header>

      <section className="fx-hero">
        <div className="fx-hero__inner">
          <div className="fx-hero__copy">
            <h1>
              The FOMO leaderboard,
              <br />
              <span className="fx-grad">run as a system</span>.
            </h1>

            <p className="fx-hero__lede">
              A copy-trading loop for fomo.family. It reads the top {FOLLOW_SET_SIZE} wallets by verified
              on-chain PnL every {SCAN_SECONDS} seconds, puts every candidate through four gates in a fixed
              order, sizes what survives against one account, and closes on a rule instead of a feeling.
            </p>

            <p className="fx-hero__lede">
              You don&apos;t watch a screen. You read the log — including every trade it refused to take.
            </p>

            <div className="fx-hero__actions">
              <Link className="fx-btn" to="/app">
                Open the terminal
              </Link>
              <Link className="fx-btn fx-btn--ghost" to="/formulas">
                Read the formulas
              </Link>
            </div>

            <dl className="fx-hero__stats">
              <div>
                <dt className="fx-mono">Follow set</dt>
                <dd>{FOLLOW_SET_SIZE} wallets</dd>
              </div>
              <div>
                <dt className="fx-mono">Base / ceiling</dt>
                <dd>2% / 6%</dd>
              </div>
              <div>
                <dt className="fx-mono">Scan</dt>
                <dd>{SCAN_SECONDS}s tick</dd>
              </div>
              <div>
                <dt className="fx-mono">Daily stop</dt>
                <dd>8%</dd>
              </div>
            </dl>
          </div>

          <HeroTerminal />
        </div>
      </section>

      {marquee.length > 0 ? (
        <div className="fx-marquee" aria-hidden="true">
          <div className="fx-marquee__track">
            {[...marquee, ...marquee].map((row, index) => (
              <span key={`${row.id}-${index}`} className="fx-mono fx-marquee__item">
                <b>{row.ticker}</b>
                <em className={row.pnlRaw >= 0 ? "fx-green" : "fx-red"}>{formatCompactUsd(row.pnlRaw)}</em>
                <i>{row.followers.toLocaleString("en-US")} followers</i>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <main className="fx-main">
          {/* 01 — the loop */}
          <section id="loop" className="fx-section">
            <SectionHead
              n="01"
              kicker="The loop"
              title="Copy trading is a shift. This is a process."
              lede="Manually mirroring a wallet means being awake, funded, and correct at the same moment. The loop replaces each of those requirements with something written down."
            />

            <div className="fx-versus">
              <div className="fx-versus__head">
                <span className="fx-mono">Doing it by hand</span>
                <span className="fx-mono fx-green">Running the loop</span>
              </div>
              {MANUAL_VS_LOOP.map((row) => (
                <div key={row.manual} className="fx-versus__row">
                  <p>
                    <em aria-hidden="true">×</em>
                    {row.manual}
                  </p>
                  <p>
                    <em className="fx-green" aria-hidden="true">
                      →
                    </em>
                    {row.loop}
                  </p>
                </div>
              ))}
            </div>

            <p className="fx-pull">
              Same bet on the same wallets — without the shift, and without the discretion.
            </p>
          </section>

          {/* 02 — gates */}
          <section id="gates" className="fx-section">
            <SectionHead
              n="02"
              kicker="Entry"
              title="Four gates, one order, no exceptions"
              lede="Cheap checks run before expensive ones, so most candidates die before a single API credit is spent. Only the last gate has alternatives — and one of the three is enough."
            />
            <GateStepper />
          </section>

          {/* 03 — sizing */}
          <section id="sizing" className="fx-section">
            <SectionHead
              n="03"
              kicker="Sizing"
              title="Three formulas. One is running."
              lede="Move the inputs and watch the size change. This is the arithmetic in fomo_cli/sizing.py — the same call the loop makes when a signal clears gate 04."
            />
            <SizingLab />
          </section>

          {/* 04 — the book */}
          <section id="book" className="fx-section">
            <SectionHead
              n="04"
              kicker="The book"
              title={`The ${book.length || 100}`}
              lede="Ranked live from the FOMO leaderboard. The top 30 form the follow set the loop actually reads; the rest stay scored so the confluence gate has something to compare against."
              aside={
                <div className="fx-controls">
                  <div className="fx-seg fx-seg--sm">
                    {["pnl", "vol", "followers"].map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={sortBy === key ? "is-active" : undefined}
                        onClick={() => setSortBy(key)}
                      >
                        {key === "pnl" ? "PnL" : key === "vol" ? "Volume" : "Reach"}
                      </button>
                    ))}
                  </div>
                  <div className="fx-seg fx-seg--sm">
                    {WINDOWS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={windowId === item.id ? "is-active" : undefined}
                        onClick={() => setWindowId(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />

            <div className="fx-table">
              <div className="fx-table__head fx-mono">
                <span>#</span>
                <span>Trader</span>
                <span>Ticker</span>
                <span className="fx-r">PnL {windowId}</span>
                <span className="fx-r">Followers</span>
                <span className="fx-r">Trades</span>
                <span>In set</span>
                <span>Wallet</span>
                <span />
              </div>

              {bookLoading && rows.length === 0 ? (
                <p className="fx-note fx-mono">loading the book…</p>
              ) : null}
              {bookError ? <p className="fx-note fx-mono fx-red">{bookError}</p> : null}
              {!LIVE_API_ENABLED ? (
                <p className="fx-note fx-mono">
                  set VITE_LIVE_API=true in frontend/.env to fill the book
                </p>
              ) : null}

              {visibleRows.map((row, index) => (
                <div key={row.id} className="fx-row">
                  <span className="fx-mono fx-row__rank">{index + 1}</span>

                  <a className="fx-row__trader" href={fomoTraderUrl(row.handle)} target="_blank" rel="noreferrer">
                    <Avatar row={row} />
                    <span>
                      <strong>{row.name}</strong>
                      <em className="fx-mono">@{row.handle}</em>
                    </span>
                  </a>

                  <span className="fx-mono fx-row__ticker">{row.ticker}</span>
                  <span className={`fx-mono fx-r ${row.pnlRaw >= 0 ? "fx-green" : "fx-red"}`}>
                    {formatCompactUsd(row.pnlRaw)}
                  </span>
                  <span className="fx-mono fx-r fx-dim">{row.followers.toLocaleString("en-US")}</span>
                  <span className="fx-mono fx-r fx-dim">{row.trades.toLocaleString("en-US")}</span>
                  <span>
                    {index < FOLLOW_SET_SIZE ? (
                      <em className="fx-mono fx-pill">followed</em>
                    ) : (
                      <em className="fx-mono fx-dim">—</em>
                    )}
                  </span>

                  <a className="fx-row__wallet fx-mono" href={explorerUrl(row)} target="_blank" rel="noreferrer">
                    {shortWallet(row.wallet) || "profile"}
                  </a>

                  <Link className="fx-btn fx-btn--xs" to="/app">
                    Copy
                  </Link>
                </div>
              ))}

              {rows.length > 20 ? (
                <button type="button" className="fx-more fx-mono" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? "Collapse" : `Show all ${rows.length} ranked wallets`}
                </button>
              ) : null}
            </div>
          </section>

          {/* 05 — session */}
          <section id="session" className="fx-section">
            <SectionHead
              n="05"
              kicker="Session"
              title="What the loop has actually done"
              lede="Read straight from the local ledger every five seconds. If the API is not running these read zero — the page does not invent numbers to look busy."
              aside={
                botError ? (
                  <p className="fx-mono fx-note fx-amber">
                    api offline — start python -m binance_trade_bot.api_server
                  </p>
                ) : null
              }
            />

            <div className="fx-metrics">
              {[
                {
                  label: "Account",
                  value: formatCompactUsd(bot.account_usd || 0),
                  note: "paper capital the sizer works against",
                },
                {
                  label: "Total PnL",
                  value: formatCompactUsd(stats?.total_pnl ?? 0),
                  note: "realized plus open, at live marks",
                  tone: (stats?.total_pnl ?? 0) >= 0 ? "green" : "red",
                },
                {
                  label: "ROI",
                  value: `${(stats?.roi_pct ?? 0).toFixed(2)}%`,
                  note: "against the configured account",
                  tone: (stats?.roi_pct ?? 0) >= 0 ? "green" : "red",
                },
                {
                  label: "Open",
                  value: `${stats?.open_count ?? 0} / 6`,
                  note: `${formatCompactUsd(stats?.open_capital ?? 0)} deployed`,
                },
                {
                  label: "Closed",
                  value: `${stats?.closed_trades ?? 0}`,
                  note: "round trips the exit rules finished",
                },
                {
                  label: "Win rate",
                  value: stats?.win_rate != null ? `${Math.round(stats.win_rate * 100)}%` : "—",
                  note: stats ? `${stats.wins}W / ${stats.losses}L` : "no closed trades yet",
                },
                {
                  label: "Session",
                  value: stats ? `${(stats.session_hours || 0).toFixed(1)}h` : "—",
                  note: "since the loop last booted",
                },
                {
                  label: "24h PnL",
                  value: formatCompactUsd(stats?.day_pnl ?? 0),
                  note: "what the 8% stop is measured on",
                  tone: (stats?.day_pnl ?? 0) >= 0 ? "green" : "red",
                },
              ].map((metric) => (
                <article key={metric.label}>
                  <p className="fx-mono fx-metric__label">{metric.label}</p>
                  <p className={`fx-metric__value fx-mono${metric.tone ? ` fx-${metric.tone}` : ""}`}>
                    {metric.value}
                  </p>
                  <p className="fx-metric__note">{metric.note}</p>
                </article>
              ))}
            </div>
          </section>

          {/* 06 — the tape */}
          <section id="tape" className="fx-section">
            <SectionHead
              n="06"
              kicker="The tape"
              title="What the follow set is doing"
              lede="Live from the fomoapi websocket. This is the raw material gate 04 reads — every entry the loop takes started as one of these lines."
              aside={
                <span className={`fx-mono fx-chip${streaming ? " is-on" : ""}`}>
                  <i className={streaming ? "is-green" : ""} />
                  {streaming ? "streaming" : "offline"}
                </span>
              }
            />

            <div className="fx-feed">
              {alerts.length === 0 ? (
                <p className="fx-note fx-mono">waiting for the next trade on the tape…</p>
              ) : (
                alerts.slice(0, 14).map((alert) => {
                  const side = alertSide(alert);
                  return (
                    <div key={alert.id || `${alert.trader}-${alert.ts}`} className="fx-feed__row">
                      <em className={`fx-mono fx-side is-${side}`}>{side}</em>
                      <p>
                        <strong>@{alert.trader}</strong> {side === "sell" ? "sold" : "bought"}{" "}
                        <b className="fx-violet">${alert.token}</b>
                      </p>
                      <span className="fx-mono">{formatCompactUsd(alert.usd || alert.amountUsd || 0)}</span>
                      <span className="fx-mono fx-dim">{age(alert.ts)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 07 — pipeline */}
          <section id="pipeline" className="fx-section">
            <SectionHead
              n="07"
              kicker="Architecture"
              title="One scan, end to end"
              lede="Keys stay server-side in the proxy. The loop writes to one SQLite ledger, and both the terminal and this page read that same snapshot — there is no second source of truth."
            />
            <PipelineDiagram />
          </section>

          {/* 08 — rails */}
          <section id="rails" className="fx-section">
            <SectionHead
              n="08"
              kicker="Risk"
              title="The rails that make it boring"
              lede="Every number here lives in fomo_cli.cfg and is read once at boot. None of them can be raised by the loop while it is running."
            />

            <div className="fx-rails">
              {RAILS.map((rail) => (
                <article key={rail.label}>
                  <p className="fx-mono fx-metric__label">{rail.label}</p>
                  <p className="fx-rails__value fx-mono">{rail.value}</p>
                  <p>{rail.body}</p>
                </article>
              ))}
            </div>
          </section>

          {/* 09 — exits */}
          <section id="exits" className="fx-section">
            <SectionHead
              n="09"
              kicker="Exits"
              title="The style decides how it ends"
              lede="A wallet is classified from median hold time, thesis count, and typical size. That single label sets both the multiplier on the way in and the rules on the way out."
            />

            <div className="fx-exits">
              {EXITS.map((exit) => (
                <article key={exit.style}>
                  <header>
                    <h3>{exit.style}</h3>
                  </header>
                  <p className="fx-exits__body">{exit.body}</p>
                  <dl className="fx-mono">
                    <div>
                      <dt>Time stop</dt>
                      <dd>{exit.time}</dd>
                    </div>
                    <div>
                      <dt>Stop</dt>
                      <dd className="fx-red">{exit.stop}</dd>
                    </div>
                    <div>
                      <dt>Take</dt>
                      <dd className={exit.take === "—" ? "fx-dim" : "fx-green"}>{exit.take}</dd>
                    </div>
                    <div>
                      <dt>Scale out</dt>
                      <dd className={exit.scale === "—" ? "fx-dim" : "fx-green"}>{exit.scale}</dd>
                    </div>
                    <div>
                      <dt>Follows their sell</dt>
                      <dd className="fx-green">yes</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          {/* 10 — modes */}
          <section id="modes" className="fx-section">
            <SectionHead
              n="10"
              kicker="Execution"
              title="Paper is the default, not the demo"
              lede="Both modes run identical gates, sizing, and exits. The only difference is whether a fill is simulated against a quote or signed against a wallet."
            />

            <div className="fx-modes">
              {MODES.map((mode) => (
                <article key={mode.mode} className={`fx-mode is-${mode.tone}`}>
                  <header>
                    <h3>{mode.mode}</h3>
                    <span className="fx-mono fx-pill">{mode.state}</span>
                  </header>
                  <ul>
                    {mode.points.map((point) => (
                      <li key={point}>
                        <em aria-hidden="true">—</em>
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* 11 — trust */}
          <section id="trust" className="fx-section">
            <SectionHead
              n="11"
              kicker="Custody"
              title="There is nothing here to take"
              lede="The honest version of a trust section: in paper mode the software has no custody, so the question of whether we would move your funds does not arise."
            />

            <div className="fx-tri">
              {TRUST.map((item) => (
                <article key={item.label}>
                  <p className="fx-mono fx-metric__label">{item.label}</p>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <div className="fx-verify">
              <h3>Check it yourself in 30 seconds</h3>
              <p>
                You don&apos;t have to read the whole codebase. A loop can only do what its functions let it
                do, and three of them touch a position. None of them holds a key.
              </p>

              <div className="fx-fns">
                {FUNCTIONS.map((fn) => (
                  <article key={fn.name}>
                    <p className="fx-mono fx-fn__name">{fn.name}</p>
                    <p className="fx-mono fx-fn__file">{fn.file}</p>
                    <p>{fn.body}</p>
                  </article>
                ))}
              </div>

              <ol className="fx-steps">
                <li>
                  <span className="fx-mono">1</span>
                  <p>
                    <strong>Open the source.</strong> Everything the loop can do is in{" "}
                    <code>fomo_cli/</code> — eight files, no build step.
                  </p>
                </li>
                <li>
                  <span className="fx-mono">2</span>
                  <p>
                    <strong>Search for the executor.</strong> In paper mode it returns a simulated fill from a
                    quote. There is no signing path to find.
                  </p>
                </li>
                <li>
                  <span className="fx-mono">3</span>
                  <p>
                    <strong>Delete the ledger.</strong> <code>data/fomo_cli.sqlite</code> is the entire state.
                    Removing it resets the account to the config.
                  </p>
                </li>
              </ol>

              <div className="fx-verify__links">
                <a className="fx-mono" href={`${REPO_URL}/blob/master/fomo_cli/copytrader.py`} target="_blank" rel="noreferrer">
                  fomo_cli/copytrader.py
                </a>
                <a className="fx-mono" href={`${REPO_URL}/blob/master/fomo_cli/sizing.py`} target="_blank" rel="noreferrer">
                  fomo_cli/sizing.py
                </a>
                <a className="fx-mono" href={`${REPO_URL}/blob/master/fomo_cli/formulas.py`} target="_blank" rel="noreferrer">
                  fomo_cli/formulas.py
                </a>
              </div>
            </div>
          </section>

          {/* 12 — CLI */}
          <section id="cli" className="fx-section">
            <SectionHead
              n="12"
              kicker="The CLI"
              title="The terminal is the primary surface"
              lede="The dashboard renders what the CLI already prints. Anything you can see on a chart, you can read as a line — including the reason a trade was refused."
            />

            <div className="fx-cli">
              {CLI.map((row) => (
                <div key={row.cmd} className="fx-cli__row">
                  <code className="fx-mono">{row.cmd}</code>
                  <p>{row.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 13 — config */}
          <section id="config" className="fx-section">
            <SectionHead
              n="13"
              kicker="The terms"
              title="Written in the config"
              lede="Nothing on this page is a policy we can change quietly. Every value below is read from a file you own, at boot, and printed in the banner when the loop starts."
            />

            <div className="fx-config">
              {CONFIG_FACTS.map((column, index) => (
                <div key={index}>
                  {column.map((fact) => (
                    <div key={fact.label} className="fx-fact">
                      <p className="fx-mono fx-metric__label">{fact.label}</p>
                      <p className={fact.mono ? "fx-mono fx-fact__mono" : undefined}>{fact.value}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="fx-cta">
              <div>
                <h3>Run it in paper mode in about two minutes.</h3>
                <p>
                  Copy the example config, start the loop, open the terminal. No wallet, no key, no money —
                  and the skip log starts filling immediately.
                </p>
              </div>
              <div className="fx-cta__actions">
                <Link className="fx-btn" to="/docs">
                  Setup guide
                </Link>
                <Link className="fx-btn fx-btn--ghost" to="/app">
                  Open terminal
                </Link>
              </div>
            </div>
          </section>

          <footer className="fx-footer">
            <div>
              <Link className="fx-brand fx-brand--sm" to="/">
                <span className="fx-brand__text">
                  fomo<b>copy</b>
                </span>
              </Link>
              <p className="fx-mono">
                unofficial tooling for fomo.family · paper by default · not financial advice
              </p>
            </div>
            <nav className="fx-footer__links fx-mono">
              <Link to="/app">Terminal</Link>
              <Link to="/docs">Docs</Link>
              <Link to="/formulas">Formulas</Link>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                Source
              </a>
              <a href="https://fomo.family" target="_blank" rel="noreferrer">
                fomo.family
              </a>
            </nav>
          </footer>
      </main>
    </div>
  );
}
