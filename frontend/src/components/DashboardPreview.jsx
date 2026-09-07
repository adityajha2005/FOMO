import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useTraderModal } from "../context/TraderModalContext.jsx";
import TraderProfileModal from "./TraderProfileModal.jsx";
import { useDashboardTerminal } from "../hooks/useDashboardTerminal.js";
import { formatCompactUsd } from "../utils/format.js";

const NAV = [
  { id: "overview", label: "Session overview", icon: "grid" },
  { id: "book", label: "The book", icon: "list" },
  { id: "positions", label: "Open positions", icon: "chart" },
  { id: "events", label: "Event log", icon: "doc" },
  { id: "sizing", label: "Sizing lab", icon: "sliders" },
  { id: "rails", label: "Risk rails", icon: "shield" },
  { id: "config", label: "Config & keys", icon: "target" },
];

const RAILS = [
  { label: "Daily stop", value: "8%", body: "Halts new entries once the day is down 8% of account." },
  { label: "Max open", value: "6", body: "Six concurrent positions — the seventh signal is skipped with a reason." },
  { label: "Liquidity floor", value: "$20k", body: "Below this the token never gets priced." },
  { label: "Holder cap", value: "45%", body: "Fails if top ten wallets hold more than 45% of supply." },
  { label: "Thesis bar", value: "0.55", body: "Holder wallets need scored theses above 0.55 for conviction entries." },
  { label: "Wallet pause", value: "−10%", body: "Pauses wallets whose last five buys average worse than −10% an hour later." },
];

const WINDOWS = [
  { id: "24h", label: "Last 24h → Now" },
  { id: "7d", label: "Last 7d → Now" },
  { id: "30d", label: "Last 30d → Now" },
  { id: "all", label: "All time → Now" },
];

const TerminalContext = createContext(null);

function useTerminalContext() {
  const value = useContext(TerminalContext);
  if (!value) {
    throw new Error("Dashboard terminal components must be used within DashboardTerminalProvider");
  }
  return value;
}

export function DashboardTerminalProvider({ children }) {
  const [windowId, setWindowId] = useState("24h");
  const [activeNav, setActiveNav] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrader, setSelectedTrader] = useState(null);
  const terminal = useDashboardTerminal(windowId);

  const openTrader = useCallback((row, rank) => {
    setSelectedTrader({ ...row, rank: rank ?? row.rank ?? 1 });
  }, []);

  const closeTrader = useCallback(() => setSelectedTrader(null), []);

  const value = useMemo(
    () => ({
      ...terminal,
      windowId,
      setWindowId,
      activeNav,
      setActiveNav,
      searchQuery,
      setSearchQuery,
      selectedTrader,
      openTrader,
      closeTrader,
    }),
    [terminal, windowId, activeNav, searchQuery, selectedTrader, openTrader, closeTrader],
  );

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

function TraderHandle({ row, className }) {
  const { openTrader: openInTerminal } = useTerminalContext();
  const pageModal = useTraderModal();
  const label = row.handle?.startsWith("@") ? row.handle : `@${row.handle}`;

  function handleClick() {
    if (openInTerminal) {
      openInTerminal(row, row.rank ?? 1);
      return;
    }
    pageModal?.openTrader(row, row.rank ?? 1);
  }

  return (
    <button type="button" className={className || "dp__trader-btn"} onClick={handleClick}>
      {label}
    </button>
  );
}

function Icon({ name }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "grid") {
    return (
      <svg {...common}>
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    );
  }
  if (name === "list") {
    return (
      <svg {...common}>
        <path d="M6 4h8M6 8h8M6 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M2 13V3M2 13h12" />
        <path d="M5 10l3-3 2.2 2.2L14 5" />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg {...common}>
        <path d="M4 2h5l3 3v9H4z" />
        <path d="M6.5 8.5h4M6.5 11h3" />
      </svg>
    );
  }
  if (name === "sliders") {
    return (
      <svg {...common}>
        <path d="M2 5h12M2 11h12" />
        <circle cx="6" cy="5" r="1.6" />
        <circle cx="10.5" cy="11" r="1.6" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M8 2l5 2v4.5c0 3-2.2 5-5 5.5-2.8-.5-5-2.5-5-5.5V4z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="1.6" />
    </svg>
  );
}

function Chrome() {
  return (
    <span className="dp__dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function formatPct(value, digits = 2) {
  const amount = Number(value) || 0;
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${amount.toFixed(digits)}%`;
}

function InteractiveAreaChart({
  path,
  values,
  viewBox,
  height,
  gradientId,
  valueLabel,
  formatValue,
}) {
  const [hover, setHover] = useState(null);
  const [, , w, h] = viewBox.split(" ").map(Number);

  function handleMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (values.length - 1));
    const x = (index / Math.max(values.length - 1, 1)) * w;
    const y = h - values[index] * h;
    const ts = new Date(Date.now() - (values.length - 1 - index) * 3600000);
    setHover({
      index,
      x,
      y,
      label: ts.toISOString().slice(11, 16) + " UTC",
      value: formatValue(values[index]),
    });
  }

  return (
    <div className="dp__chart-wrap">
      <svg
        className="dp__chart"
        viewBox={viewBox}
        style={{ height }}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`${valueLabel} chart`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--vio)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--vio)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1="0" y1={h * ratio} x2={w} y2={h * ratio} className="dp__gridline" />
        ))}

        <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${gradientId})`} />
        <path d={path} className="dp__line" />

        {hover ? (
          <>
            <line x1={hover.x} y1={0} x2={hover.x} y2={h} className="dp__crosshair" />
            <circle cx={hover.x} cy={hover.y} r="4.5" className="dp__point" />
          </>
        ) : null}
      </svg>

      {hover ? (
        <span className="dp__tip" style={{ left: `${(hover.x / w) * 100}%` }}>
          <b>{hover.label}</b>
          <i>
            {valueLabel} {hover.value}
          </i>
        </span>
      ) : null}
    </div>
  );
}

function TerminalSidebar({ compact = false }) {
  const { activeNav, setActiveNav, closeTrader } = useTerminalContext();
  const items = compact ? NAV.slice(0, 3) : NAV;

  function selectNav(id) {
    closeTrader();
    setActiveNav(id);
  }

  return (
    <aside className="dp__side">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === activeNav ? "dp__nav is-active" : "dp__nav"}
          onClick={() => selectNav(item.id)}
        >
          <Icon name={item.icon} />
          {item.label}
        </button>
      ))}
    </aside>
  );
}

function TerminalHeader({ compact = false }) {
  const { activeNav, connected, searchQuery, setSearchQuery, setActiveNav, closeTrader } = useTerminalContext();
  const active = NAV.find((item) => item.id === activeNav) || NAV[0];

  function submitSearch(event) {
    event.preventDefault();
    closeTrader();
    setActiveNav("book");
  }

  return (
    <header className="dp__head">
      <div className="dp__title">
        <strong>{active.label}</strong>
        <span className="dp__source">fomo.family</span>
        {connected ? <span className="dp__live">live</span> : <span className="dp__live is-off">offline</span>}
      </div>

      {!compact ? (
        <form className="dp__search-form" onSubmit={submitSearch}>
          <input
            className="dp__search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search wallets, tickers…"
            aria-label="Search wallets and tickers"
          />
        </form>
      ) : null}
    </header>
  );
}

function WindowFilter() {
  const { windowId, setWindowId } = useTerminalContext();
  const [open, setOpen] = useState(false);
  const active = WINDOWS.find((item) => item.id === windowId) || WINDOWS[0];

  return (
    <div className="dp__filters">
      <div className="dp__chip-wrap">
        <button type="button" className="dp__chip" onClick={() => setOpen((value) => !value)}>
          {active.label}
        </button>
        {open ? (
          <div className="dp__menu" role="menu">
            {WINDOWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={item.id === windowId ? "is-active" : undefined}
                onClick={() => {
                  setWindowId(item.id);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" className="dp__dot-btn" aria-label="Time window options" aria-hidden="true" tabIndex={-1} />
    </div>
  );
}

function OverviewPanel({ compact = false }) {
  const {
    roiPct,
    roiDelta,
    walletCount,
    walletDelta,
    earners,
    maxEarnerPnl,
    copiedVolumeUsd,
    volumeDelta,
    roiPath,
    volumePath,
    roiValues,
    volumeValues,
    loading,
    searchQuery,
    setSearchQuery,
  } = useTerminalContext();

  const filteredEarners = earners.filter((row) =>
    row.handle.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  if (compact) {
    return (
      <>
        <WindowFilter />
        <section className="dp__card">
          <p className="dp__label">ROI</p>
          <p className="dp__value">
            {formatPct(roiPct, 2)}
            <em>{formatPct(roiDelta, 1)}</em>
          </p>
          <InteractiveAreaChart
            path={roiPath}
            values={roiValues}
            viewBox="0 0 340 96"
            height={72}
            gradientId="dp-g3"
            valueLabel="ROI"
            formatValue={(value) => `${(value * 12).toFixed(1)}%`}
          />
        </section>
      </>
    );
  }

  return (
    <>
      <WindowFilter />
      <div className="dp__grid">
        <section className="dp__card">
          <p className="dp__label">ROI</p>
          <p className="dp__value">
            {loading ? "…" : formatPct(roiPct, 2)}
            <em>{formatPct(roiDelta, 1)}</em>
          </p>
          <InteractiveAreaChart
            path={roiPath}
            values={roiValues}
            viewBox="0 0 340 96"
            height={96}
            gradientId="dp-g1"
            valueLabel="ROI"
            formatValue={(value) => `${(value * 12).toFixed(1)}%`}
          />
        </section>

        <section className="dp__card">
          <p className="dp__label">Wallets ranked</p>
          <p className="dp__value">
            {walletCount}
            <em>+{walletDelta}</em>
          </p>
          <p className="dp__sub">Top earners</p>
          <input
            className="dp__filter"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter handles…"
            aria-label="Filter top earners"
          />
          <ul className="dp__list">
            {filteredEarners.map((row) => (
              <li key={row.handle}>
                <TraderHandle row={row} />
                <span style={{ width: `${Math.max(12, (row.pnlRaw / maxEarnerPnl) * 100)}%` }} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="dp__card dp__card--wide">
        <p className="dp__label">Copied volume</p>
        <p className="dp__value">
          {formatCompactUsd(copiedVolumeUsd)}
          <em>{formatPct(volumeDelta, 1)}</em>
        </p>
        <InteractiveAreaChart
          path={volumePath}
          values={volumeValues}
          viewBox="0 0 900 120"
          height={120}
          gradientId="dp-g2"
          valueLabel="Vol"
          formatValue={(value) => formatCompactUsd(value * copiedVolumeUsd)}
        />
      </section>
    </>
  );
}

function PositionsPanel() {
  const { openPositions, topTraders, openTrader } = useTerminalContext();

  function openHandle(handle) {
    const normalized = (handle || "").replace(/^@/, "");
    const row = topTraders.find((entry) => entry.handle === normalized);
    if (row) {
      openTrader(row, row.rank);
    }
  }

  return (
    <section className="dp__panel">
      <p className="dp__label">Open positions</p>
      {openPositions.length === 0 ? (
        <p className="dp__empty">No open positions right now.</p>
      ) : (
        <ul className="dp__rows">
          {openPositions.map((row) => (
            <li key={row.id}>
              <strong>{row.token}</strong>
              <button type="button" className="dp__trader-btn" onClick={() => openHandle(row.handle)}>
                @{row.handle}
              </button>
              <em>{formatCompactUsd(row.usd_in)}</em>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventsPanel() {
  const { events } = useTerminalContext();

  return (
    <section className="dp__panel">
      <p className="dp__label">Event log</p>
      <ul className="dp__rows dp__rows--events">
        {events.length === 0 ? (
          <li className="dp__empty">Waiting for the next loop tick…</li>
        ) : (
          events.slice(0, 12).map((event) => (
            <li key={event.id}>
              <span>{new Date((Number(event.ts) || 0) * 1000).toISOString().slice(11, 16)} UTC</span>
              <strong>{event.kind}</strong>
              <em>{event.text}</em>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function BookPanel() {
  const { topTraders, maxEarnerPnl, searchQuery } = useTerminalContext();
  const query = searchQuery.trim().toLowerCase();
  const rows = query
    ? topTraders.filter(
        (row) =>
          row.handle.toLowerCase().includes(query) ||
          (row.name || "").toLowerCase().includes(query) ||
          (row.ticker || "").toLowerCase().includes(query),
      )
    : topTraders;

  return (
    <section className="dp__panel">
      <p className="dp__label">Top 30 follow set</p>
      {query ? <p className="dp__sub">Filtered by “{searchQuery.trim()}”</p> : null}
      <ul className="dp__rows">
        {rows.length === 0 ? (
          <li className="dp__empty">No traders match that search.</li>
        ) : (
          rows.map((row) => (
            <li key={row.handle}>
              <span>{row.rank}</span>
              <TraderHandle row={row} />
              <em>{formatCompactUsd(row.pnlRaw)}</em>
              <span className="dp__meter" style={{ width: `${Math.max(10, (row.pnlRaw / maxEarnerPnl) * 100)}%` }} />
            </li>
          ))
        )}
      </ul>
      <p className="dp__hint">Click any trader to open their genome + mind reader profile.</p>
    </section>
  );
}

function SizingPanel() {
  return (
    <section className="dp__panel">
      <p className="dp__label">Sizing lab</p>
      <ul className="dp__kv">
        <li>
          <span>Base size</span>
          <strong>2% of account</strong>
        </li>
        <li>
          <span>Hard ceiling</span>
          <strong>6% of account</strong>
        </li>
        <li>
          <span>Trencher multiplier</span>
          <strong>0.5×</strong>
        </li>
        <li>
          <span>Holder multiplier</span>
          <strong>1.25×</strong>
        </li>
        <li>
          <span>Liquidity cap</span>
          <strong>1% of pool</strong>
        </li>
      </ul>
      <p className="dp__hint">
        Conviction score scales the base between 0.5× and 1.5× before the ceiling clamp runs.
      </p>
    </section>
  );
}

function RailsPanel() {
  return (
    <section className="dp__panel">
      <p className="dp__label">Risk rails</p>
      <ul className="dp__rails">
        {RAILS.map((rail) => (
          <li key={rail.label}>
            <div className="dp__rail-head">
              <strong>{rail.label}</strong>
              <em>{rail.value}</em>
            </div>
            <p>{rail.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfigPanel() {
  const { mode, accountUsd, connected } = useTerminalContext();

  return (
    <section className="dp__panel">
      <p className="dp__label">Config & keys</p>
      <ul className="dp__kv">
        <li>
          <span>Mode</span>
          <strong>{mode}</strong>
        </li>
        <li>
          <span>Account</span>
          <strong>{formatCompactUsd(accountUsd)}</strong>
        </li>
        <li>
          <span>Feed</span>
          <strong>{connected ? "Connected" : "Offline"}</strong>
        </li>
        <li>
          <span>Scan interval</span>
          <strong>20s</strong>
        </li>
      </ul>
      <p className="dp__hint">Paper mode by default. Copy example config, start the loop, and watch the skip log fill.</p>
    </section>
  );
}

function TerminalMain({ compact = false }) {
  const { activeNav } = useTerminalContext();

  let panel = <OverviewPanel compact={compact} />;
  if (!compact) {
    if (activeNav === "positions") panel = <PositionsPanel />;
    if (activeNav === "events") panel = <EventsPanel />;
    if (activeNav === "book") panel = <BookPanel />;
    if (activeNav === "sizing") panel = <SizingPanel />;
    if (activeNav === "rails") panel = <RailsPanel />;
    if (activeNav === "config") panel = <ConfigPanel />;
  }

  return (
    <div className="dp__main">
      <TerminalHeader compact={compact} />
      {panel}
    </div>
  );
}

function TerminalShell({ compact = false, label, className = "" }) {
  const { selectedTrader, closeTrader } = useTerminalContext();

  return (
    <div className={`dp ${className}`.trim()} role="region" aria-label={label}>
      <div className="dp__bar">
        <Chrome />
      </div>
      <div className="dp__body">
        <TerminalSidebar compact={compact} />
        <TerminalMain compact={compact} />
      </div>
      {selectedTrader ? (
        <TraderProfileModal embedded trader={selectedTrader} onClose={closeTrader} />
      ) : null}
    </div>
  );
}

/** Live terminal preview used in the hero. */
export default function DashboardPreview() {
  return <TerminalShell label="Session terminal preview" />;
}

export function MiniDashboard() {
  return <TerminalShell compact label="Session overview preview" className="dp--mini" />;
}

export function VolumeCard() {
  const { copiedVolumeUsd, volumeDelta, volumePath, volumeValues } = useTerminalContext();

  return (
    <div className="dp dp--card" role="region" aria-label="Copied volume preview">
      <section className="dp__card">
        <p className="dp__label">Copied volume</p>
        <p className="dp__value">
          {formatCompactUsd(copiedVolumeUsd)}
          <em>{formatPct(volumeDelta, 1)}</em>
        </p>
        <InteractiveAreaChart
          path={volumePath}
          values={volumeValues}
          viewBox="0 0 900 120"
          height={96}
          gradientId="dp-g4"
          valueLabel="Vol"
          formatValue={(value) => formatCompactUsd(value * copiedVolumeUsd)}
        />
      </section>
    </div>
  );
}
