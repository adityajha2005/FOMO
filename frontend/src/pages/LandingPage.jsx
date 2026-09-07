import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DashboardPreview, {
  DashboardTerminalProvider,
  MiniDashboard,
  VolumeCard,
} from "../components/DashboardPreview.jsx";
import BrandLogo from "../components/BrandLogo.jsx";
import TraderProfileModal from "../components/TraderProfileModal.jsx";
import { TraderModalContext } from "../context/TraderModalContext.jsx";
import GateStepper from "../components/GateStepper.jsx";
import HeroTerminal from "../components/HeroTerminal.jsx";
import { LIVE_API_ENABLED } from "../config/api.js";
import { useCopyTrader } from "../hooks/useCopyTrader.js";
import { getBookTraders } from "../services/fomoApi.js";
import { ThesisVisual, THESIS_VISUAL_BLOCKS, ThesisPullQuote } from "../components/ThesisVisuals.jsx";
import { formatCompactUsd } from "../utils/format.js";
import { fomoTraderUrl } from "../utils/links.js";
import "./LandingPage.css";

const REPO_URL = "https://github.com/Adi101-coder/FOMO";
const FOLLOW_SET_SIZE = 30;
const BOOK_LIMIT = 122;
const SCAN_SECONDS = 20;

const NAV = [
  {
    id: "product",
    label: "Product",
    items: [
      { label: "Session terminal", to: "/app" },
      { label: "The thesis", href: "#thesis" },
      { label: "The book", href: "#book" },
      { label: "Risk rails", href: "#rails" },
    ],
  },
  { id: "terminal", label: "Terminal", to: "/app" },
  {
    id: "resources",
    label: "Resources",
    items: [
      { label: "Documentation", to: "/docs" },
      { label: "Formula reference", to: "/formulas" },
      { label: "Source on GitHub", href: REPO_URL, external: true },
    ],
  },
  { id: "docs", label: "Docs", to: "/docs" },
  { id: "formulas", label: "Formulas", to: "/formulas" },
];

const PLATFORMS = [
  { name: "Solana", mark: "solana" },
  { name: "Base", mark: "base" },
  { name: "BNB Chain", mark: "bnb" },
  { name: "Ethereum", mark: "eth" },
  { name: "Robinhood", mark: "robin" },
  { name: "DexScreener", mark: "dex" },
  { name: "Pons", mark: "pons" },
  { name: "FOMO API", mark: "fomo" },
];

const BENTO = [
  {
    id: "dashboard",
    accent: true,
    visual: { type: "dashboard" },
    title: "Terminal-grade dashboard",
    body: "Read positions, live marks, and the full skip log in one pass — without touching the CLI.",
  },
  {
    id: "reports",
    visual: { type: "volume" },
    title: "Live session reports",
    body: "Realized and open PnL recomputed straight from the local ledger every five seconds.",
  },
];

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
    time: "30 min",
    stop: "−15%",
    take: "+40%",
    scale: "—",
    body: "In and out under fifteen minutes. Sized at half, stopped tight, and time-stopped fast — the edge decays before the hour does.",
  },
  {
    style: "Flipper",
    time: "24 h",
    stop: "−25%",
    take: "—",
    scale: "50% at +50%",
    body: "The default register. Full size, a day of rope, and half the position off the table at +50% so the rest can run without the entry being at risk.",
  },
  {
    style: "Holder",
    time: "14 d",
    stop: "−35%",
    take: "—",
    scale: "—",
    body: "Sized up, held longest, widest stop. These are the wallets that post a thesis, so the position lives until the thesis breaks or the trader sells.",
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

function formatEth(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) {
    return "—";
  }
  if (amount >= 1000) {
    return amount.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  if (amount >= 1) {
    return amount.toFixed(2);
  }
  return amount.toFixed(3);
}

function formatBookPnl(value) {
  const amount = Number(value) || 0;
  if (amount === 0) {
    return "$0";
  }
  return formatCompactUsd(amount);
}

function shortWallet(wallet) {
  if (!wallet) {
    return null;
  }
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function explorerUrl(row) {
  const address = row.contract || row.wallet;
  if (!address) {
    return fomoTraderUrl(row.handle);
  }
  const isSolana = row.walletIsSolana || (!address.startsWith("0x") && address.length > 32);
  return isSolana
    ? `https://solscan.io/account/${address}`
    : `https://etherscan.io/address/${address}`;
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

function PlatformMark({ mark }) {
  const props = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" };

  if (mark === "solana") {
    return (
      <svg {...props}>
        <path d="M5 6h9l-3 3H2zM6 10h9l-3 3H3zM5 14h9l-3 3H2z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (mark === "base") {
    return (
      <svg {...props}>
        <path d="M10 3a7 7 0 100 14h-.5V3z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (mark === "bnb") {
    return (
      <svg {...props}>
        <rect x="8.6" y="2.6" width="3.2" height="3.2" transform="rotate(45 10.2 4.2)" fill="currentColor" stroke="none" />
        <rect x="8.6" y="8.6" width="3.2" height="3.2" transform="rotate(45 10.2 10.2)" fill="currentColor" stroke="none" />
        <rect x="3.4" y="8.6" width="2.6" height="2.6" transform="rotate(45 4.7 9.9)" fill="currentColor" stroke="none" />
        <rect x="14.2" y="8.6" width="2.6" height="2.6" transform="rotate(45 15.5 9.9)" fill="currentColor" stroke="none" />
        <rect x="8.6" y="14.4" width="3.2" height="3.2" transform="rotate(45 10.2 16)" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (mark === "eth") {
    return (
      <svg {...props}>
        <path d="M10 2l5 8-5 3-5-3z" fill="currentColor" stroke="none" opacity=".85" />
        <path d="M10 14.2l5-3-5 6.8-5-6.8z" fill="currentColor" stroke="none" opacity=".55" />
      </svg>
    );
  }
  if (mark === "robin") {
    return (
      <svg {...props}>
        <path d="M6 17V6a4 4 0 018 0v11" />
        <path d="M6 11h8" />
      </svg>
    );
  }
  if (mark === "dex") {
    return (
      <svg {...props}>
        <path d="M5 13V7M5 5v2M5 13v2M10 15V5M10 3v2M10 15v2M15 11V9M15 5v4M15 11v4" />
      </svg>
    );
  }
  if (mark === "pons") {
    return (
      <svg {...props}>
        <path d="M3 14c0-4 3.1-7 7-7s7 3 7 7" />
        <path d="M3 14h14M7 14v-3M13 14v-3" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M10 3v14M3.9 6.5l12.2 7M16.1 6.5l-12.2 7" />
    </svg>
  );
}

function NavMenu({ item, openId, setOpenId }) {
  const open = openId === item.id;

  if (!item.items) {
    return (
      <Link className="nav__link" to={item.to}>
        {item.label}
      </Link>
    );
  }

  return (
    <div
      className={open ? "nav__group is-open" : "nav__group"}
      onMouseEnter={() => setOpenId(item.id)}
      onMouseLeave={() => setOpenId(null)}
    >
      <button
        type="button"
        className="nav__link nav__link--toggle"
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : item.id)}
      >
        {item.label}
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="nav__menu" role="menu">
        {item.items.map((child) =>
          child.external ? (
            <a key={child.label} href={child.href} target="_blank" rel="noreferrer" role="menuitem">
              {child.label}
            </a>
          ) : child.to ? (
            <Link key={child.label} to={child.to} role="menuitem">
              {child.label}
            </Link>
          ) : (
            <a key={child.label} href={child.href} role="menuitem" onClick={() => setOpenId(null)}>
              {child.label}
            </a>
          ),
        )}
      </div>
    </div>
  );
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
  const [bookLiveAt, setBookLiveAt] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [selectedTrader, setSelectedTrader] = useState(null);
  const navRef = useRef(null);

  const openTrader = useCallback((row, rank) => {
    setSelectedTrader({ ...row, rank: rank ?? row.rank });
  }, []);

  const traderModal = useMemo(
    () => ({
      openTrader,
      book,
    }),
    [openTrader, book],
  );

  const countdown = useScanCountdown();
  const { data: bot, error: botError } = useCopyTrader();

  useEffect(() => {
    function onPointerDown(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!LIVE_API_ENABLED) {
      setBookLoading(false);
      return undefined;
    }

    let active = true;
    setBookLoading(true);

    getBookTraders({ window: windowId, limit: BOOK_LIMIT })
      .then((rows) => {
        if (active) {
          setBook(rows);
          setBookError(null);
          setBookLiveAt(new Date());
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
    if (sortBy === "mcap") {
      sorted.sort((a, b) => b.followers - a.followers || b.pnlRaw - a.pnlRaw);
    } else {
      sorted.sort((a, b) => b.pnlRaw - a.pnlRaw || b.followers - a.followers);
    }
    return sorted;
  }, [book, sortBy]);

  const bookLiveLabel = bookLiveAt
    ? bookLiveAt.toISOString().replace("T", " ").slice(0, 16)
    : null;
  const stats = bot.stats;
  const marquee = book.slice(0, 14);

  return (
    <DashboardTerminalProvider>
    <TraderModalContext.Provider value={traderModal}>
    <div className="fx">
      {/* ── Nav ── */}
      <header className="nav" ref={navRef}>
        <div className="nav__inner">
          <Link className="nav__logo" to="/" aria-label="fomocopy home">
            <BrandLogo size={34} />
          </Link>

          <nav className="nav__pill" aria-label="Main">
            {NAV.map((item) => (
              <NavMenu key={item.id} item={item} openId={openMenu} setOpenId={setOpenMenu} />
            ))}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />

        <div className="hero__inner">
          <div className="hero__copy">
            <h1 className="hero__title">
              <span className="hero__title-primary">
                <span className="hero__title-line">30 top traders.</span>
                <span className="hero__title-line">One portfolio.</span>
              </span>
              <span className="hero__title-secondary">
                The confluence fund that turns their{" "}
                <em className="hero__emphasis">FOMO</em> into{" "}
                <em className="hero__emphasis">your allocation.</em>
              </span>
            </h1>

            <Link className="btn btn--light hero__cta" to="/app">
              Start in paper mode
            </Link>
          </div>

          <div className="hero__shot">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ── Platforms ── */}
      <section className="logos">
        <p className="logos__label">Reads live data from the venues the family trades on</p>

        <div className="logos__grid">
          {PLATFORMS.map((platform) => (
            <div key={platform.name} className="logos__cell">
              <PlatformMark mark={platform.mark} />
              <span>{platform.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Thesis ── */}
      <section id="thesis" className="thesis">
        <div className="thesis__inner">
          <div className="thesis__stat">
            <p className="thesis__stat-label fx-mono">Top 30 cumulative PnL</p>
            <div className="thesis__stat-row">
              <span className="thesis__stat-from">$7M</span>
              <span className="thesis__stat-arrow" aria-hidden="true">
                →
              </span>
              <span className="thesis__stat-to">$45M</span>
              <em className="thesis__stat-delta fx-mono">+700% in one month</em>
            </div>
            <p className="thesis__stat-note">
              Top 30 cumulative PnL moved from <strong>$7M</strong> to <strong>$45M</strong> in one month.
            </p>
          </div>

          <div className="thesis__grid">
            {THESIS_VISUAL_BLOCKS.map((block) => (
              <article key={block.id} className="thesis__card">
                <div className="thesis__viz">
                  <ThesisVisual id={block.id} />
                  <span className="thesis__metric fx-mono">{block.metric}</span>
                </div>
                <h3>{block.title}</h3>
                <p>{block.caption}</p>
              </article>
            ))}
          </div>

          <blockquote className="thesis__pull">
            <ThesisPullQuote />
          </blockquote>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features">
        <h2 className="features__title">
          Systematic, auditable, and built
          <br />
          for the cycle ahead.
        </h2>

        <div className="features__cards">
          {BENTO.map((card) => (
            <article
              key={card.id}
              className={`bento__card${card.accent ? " is-accent" : ""}`}
            >
              <div className="bento__visual">
                {card.visual.type === "dashboard" ? <MiniDashboard /> : <VolumeCard />}
              </div>
              <div className="bento__text">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            </article>
          ))}
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

        {/* 03 — the book */}
        <section id="book" className="fx-section fx-section--book">
          <SectionHead
            n="03"
            kicker="The book"
            title="The 122"
            lede="Ranked from the live FOMO leaderboard. Not on PnL alone: a coin needs a buyer base, so audience carries the same weight as profit."
            aside={
              <div className="fx-controls fx-controls--book">
                <div className="fx-seg fx-seg--sm">
                  {[
                    { id: "mcap", label: "MCAP" },
                    { id: "pnl", label: "PNL" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={sortBy === item.id ? "is-active" : undefined}
                      onClick={() => setSortBy(item.id)}
                    >
                      {item.label}
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
                {bookLiveLabel ? (
                  <p className="fx-book__live fx-mono">
                    LIVE <time dateTime={bookLiveAt?.toISOString()}>{bookLiveLabel} UTC</time>
                  </p>
                ) : null}
              </div>
            }
          />

          <div className="fx-book">
            <div className="fx-book__head fx-mono">
              <span>#</span>
              <span>Trader</span>
              <span>Ticker</span>
              <span className="fx-r">PnL {windowId.toUpperCase()}</span>
              <span className="fx-r">Followers</span>
              <span className="fx-r">Fees ETH</span>
              <span className="fx-r">Mcap ETH</span>
              <span>Contract</span>
              <span />
            </div>

            <div className="fx-book__body">
              {bookLoading && rows.length === 0 ? (
                <p className="fx-book__note fx-mono">Loading the book…</p>
              ) : null}
              {bookError ? <p className="fx-book__note fx-mono fx-book__note--error">{bookError}</p> : null}
              {!LIVE_API_ENABLED ? (
                <p className="fx-book__note fx-mono">
                  Set VITE_LIVE_API=true and FOMO_API_KEY in frontend/.env to fill the book
                </p>
              ) : null}

              {rows.map((row, index) => (
                <div key={row.id} className="fx-book__row">
                  <span className="fx-mono fx-book__rank">{index + 1}</span>

                  {index < FOLLOW_SET_SIZE ? (
                    <button
                      type="button"
                      className="fx-book__trader"
                      onClick={() => openTrader(row, index + 1)}
                      aria-label={`Open profile for @${row.handle}`}
                    >
                      <Avatar row={row} />
                      <span>
                        <strong>{row.name}</strong>
                        <em className="fx-mono">@{row.handle}</em>
                      </span>
                    </button>
                  ) : (
                    <a className="fx-book__trader" href={fomoTraderUrl(row.handle)} target="_blank" rel="noreferrer">
                      <Avatar row={row} />
                      <span>
                        <strong>{row.name}</strong>
                        <em className="fx-mono">@{row.handle}</em>
                      </span>
                    </a>
                  )}

                  <span className="fx-mono fx-book__ticker">{row.ticker}</span>

                  <span
                    className={`fx-mono fx-r fx-book__pnl ${
                      row.pnlRaw > 0 ? "is-up" : row.pnlRaw < 0 ? "is-down" : "is-flat"
                    }`}
                  >
                    {formatBookPnl(row.pnlRaw)}
                  </span>

                  <span className="fx-mono fx-r fx-book__muted">{row.followers.toLocaleString("en-US")}</span>

                  <span className="fx-mono fx-r fx-book__muted fx-book__fees">
                    {formatEth(row.feesEth)}
                    {row.graduated ? <i className="fx-book__badge">Graduated</i> : null}
                  </span>

                  <span className="fx-mono fx-r fx-book__muted">{formatEth(row.mcapEth)}</span>

                  <span className="fx-book__contract">
                    <a className="fx-mono" href={explorerUrl(row)} target="_blank" rel="noreferrer">
                      {shortWallet(row.contract || row.wallet) || "profile"}
                    </a>
                    {row.contract || row.wallet ? (
                      <a className="fx-mono fx-book__explorer" href={explorerUrl(row)} target="_blank" rel="noreferrer">
                        explorer
                      </a>
                    ) : null}
                  </span>

                  <Link className="btn btn--book" to="/app">
                    Buy
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 04 — session */}
        <section id="session" className="fx-section">
          <SectionHead
            n="04"
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
                <p className={`fx-metric__value${metric.tone ? ` fx-${metric.tone}` : ""}`}>{metric.value}</p>
                <p className="fx-metric__note">{metric.note}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 05 — rails */}
        <section id="rails" className="fx-section">
          <SectionHead
            n="05"
            kicker="Risk"
            title="The rails that make it boring"
            lede="Every number here lives in fomo_cli.cfg and is read once at boot. None of them can be raised by the loop while it is running."
          />

          <div className="fx-rails">
            {RAILS.map((rail) => (
              <article key={rail.label}>
                <p className="fx-mono fx-metric__label">{rail.label}</p>
                <p className="fx-rails__value">{rail.value}</p>
                <p>{rail.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 06 — exits */}
        <section id="exits" className="fx-section">
          <SectionHead
            n="06"
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

        {/* 07 — trust */}
        <section id="trust" className="fx-section">
          <SectionHead
            n="07"
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
              You don&apos;t have to read the whole codebase. A loop can only do what its functions let it do,
              and three of them touch a position. None of them holds a key.
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
                  <strong>Open the source.</strong> Everything the loop can do is in <code>fomo_cli/</code> —
                  eight files, no build step.
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

        {/* 08 — CLI */}
        <section id="cli" className="fx-section">
          <SectionHead
            n="08"
            kicker="The CLI"
            title="The terminal is the primary surface"
            lede="The dashboard renders what the CLI already prints. Anything you can see on a chart, you can read as a line — including the reason a trade was refused."
          />

          <div className="fx-cli-grid">
            <div className="fx-cli">
              {CLI.map((row) => (
                <div key={row.cmd} className="fx-cli__row">
                  <code className="fx-mono">{row.cmd}</code>
                  <p>{row.desc}</p>
                </div>
              ))}
            </div>

            <HeroTerminal />
          </div>
        </section>

        {/* 09 — config */}
        <section id="config" className="fx-section">
          <SectionHead
            n="09"
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
            <div className="fx-cta__glow" aria-hidden="true" />
            <div>
              <h3>Run it in paper mode in about two minutes.</h3>
              <p>
                Copy the example config, start the loop, open the terminal. No wallet, no key, no money — and
                the skip log starts filling immediately.
              </p>
            </div>
            <div className="fx-cta__actions">
              <Link className="btn btn--light" to="/docs">
                Setup guide
              </Link>
              <Link className="btn btn--ghost" to="/app">
                Open terminal
              </Link>
            </div>
          </div>
        </section>

        <footer className="fx-footer">
          <div>
            <BrandLogo size={28} />
            <p>unofficial tooling for fomo.family · paper by default · not financial advice</p>
          </div>

          <nav className="fx-footer__links">
            <Link to="/app">Terminal</Link>
            <Link to="/docs">Docs</Link>
            <Link to="/formulas">Formulas</Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              Source
            </a>
            <a href="https://fomo.family" target="_blank" rel="noreferrer">
              fomo.family
            </a>
            <span className="fx-footer__stat">
              {bot.mode === "live" ? "live" : "paper"} · {stats?.open_count ?? 0}/6 open · scan {countdown}s
            </span>
          </nav>
        </footer>
      </main>
    </div>

    {selectedTrader ? (
      <TraderProfileModal trader={selectedTrader} onClose={() => setSelectedTrader(null)} />
    ) : null}
    </TraderModalContext.Provider>
    </DashboardTerminalProvider>
  );
}
