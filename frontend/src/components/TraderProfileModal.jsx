import { useEffect, useMemo } from "react";
import { buildTraderProfile, radarAxisPoints, radarPolygon } from "../utils/traderProfile.js";
import { fomoTraderUrl } from "../utils/links.js";
import "./TraderProfileModal.css";

function shortWallet(wallet) {
  if (!wallet || wallet.length < 10) return wallet || "—";
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function formatUsd(value) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

function TraitBars({ traits }) {
  const items = [
    { key: "risk", label: "Risk" },
    { key: "speed", label: "Speed" },
    { key: "conviction", label: "Conviction" },
    { key: "patience", label: "Patience" },
    { key: "leverage", label: "Leverage" },
  ];

  return (
    <div className="tpm__traits">
      {items.map(({ key, label }) => (
        <div key={key} className="tpm__trait">
          <div className="tpm__trait-head">
            <span>{label}</span>
            <em className="fx-mono">{traits[key]}%</em>
          </div>
          <div className="tpm__trait-bar" aria-hidden="true">
            {Array.from({ length: 20 }, (_, index) => (
              <i key={index} className={index < Math.round((traits[key] / 100) * 20) ? "is-on" : ""} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RadarChart({ traits }) {
  const cx = 90;
  const cy = 90;
  const radius = 62;
  const axes = radarAxisPoints(cx, cy, radius);
  const avgTraits = { risk: 52, speed: 58, conviction: 55, patience: 48, leverage: 50 };

  return (
    <div className="tpm__radar-wrap">
      <svg className="tpm__radar" viewBox="0 0 180 180" aria-hidden="true">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={radarPolygon(
              { risk: 100 * scale, speed: 100 * scale, conviction: 100 * scale, patience: 100 * scale, leverage: 100 * scale },
              cx,
              cy,
              radius,
            )}
            className="tpm__radar-grid"
          />
        ))}
        {axes.map((axis) => (
          <line key={axis.label} x1={cx} y1={cy} x2={axis.x} y2={axis.y} className="tpm__radar-axis" />
        ))}
        <polygon points={radarPolygon(avgTraits, cx, cy, radius)} className="tpm__radar-avg" />
        <polygon points={radarPolygon(traits, cx, cy, radius)} className="tpm__radar-self" />
      </svg>
      <div className="tpm__radar-legend">
        <span>
          <i className="is-self" /> This wallet
        </span>
        <span>
          <i className="is-avg" /> Average
        </span>
      </div>
    </div>
  );
}

function MiniCandles({ bullish = true }) {
  const bars = [0.35, 0.55, 0.42, 0.68, 0.52, 0.78, 0.61, 0.88];
  return (
    <svg className="tpm__candles" viewBox="0 0 220 72" aria-hidden="true">
      {bars.map((height, index) => {
        const up = bullish || index > 4;
        const x = 8 + index * 26;
        const bodyH = height * 36;
        const y = 58 - bodyH;
        return (
          <g key={index}>
            <line x1={x + 6} y1={y - 6} x2={x + 6} y2={58} className={up ? "up" : "down"} />
            <rect x={x} y={y} width={12} height={bodyH} rx={1} className={up ? "up" : "down"} />
          </g>
        );
      })}
      <circle cx={168} cy={22} r={10} className="tpm__buy-dot" />
      <text x={168} y={26} textAnchor="middle" className="tpm__buy-label">
        Buy
      </text>
    </svg>
  );
}

function ModalAvatar({ profile, row }) {
  if (row?.avatarUrl) {
    return <img className="tpm__avatar" src={row.avatarUrl} alt="" referrerPolicy="no-referrer" />;
  }
  return <span className="tpm__avatar tpm__avatar--fallback">{profile.initials}</span>;
}

export default function TraderProfileModal({ trader, onClose, embedded = false }) {
  const profile = useMemo(() => buildTraderProfile(trader, trader.rank), [trader]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className={embedded ? "tpm tpm--embedded" : "tpm"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tpm-title"
    >
      <button type="button" className="tpm__backdrop" aria-label="Close profile" onClick={onClose} />

      <div className="tpm__sheet">
        <header className="tpm__header">
          <div className="tpm__identity">
            <ModalAvatar profile={profile} row={trader} />
            <div>
              <p className="tpm__rank fx-mono">#{profile.rank} · Top 30 follow set</p>
              <h2 id="tpm-title">
                @{profile.handle}
                {!embedded ? (
                  <a className="tpm__ext" href={fomoTraderUrl(profile.handle)} target="_blank" rel="noreferrer">
                    Open on FOMO ↗
                  </a>
                ) : null}
              </h2>
              <p className="tpm__wallet fx-mono">{shortWallet(profile.wallet)}</p>
              <div className="tpm__tags">
                {profile.tags.map((tag) => (
                  <span key={tag.label} className={`tpm__tag tpm__tag--${tag.tone}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button type="button" className="tpm__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <section className="tpm__section">
          <div className="tpm__section-head">
            <h3>
              <span aria-hidden="true">🧬</span> Wallet Genome
            </h3>
            <p>Behavioral fingerprint derived from on-chain activity and leaderboard stats.</p>
          </div>

          <div className="tpm__genome">
            <div className="tpm__card tpm__card--traits">
              <p className="tpm__card-label fx-mono">WALLET GENOME</p>
              <TraitBars traits={profile.genome.traits} />
            </div>

            <div className="tpm__card tpm__card--summary">
              <span className={`tpm__archetype tpm__archetype--${profile.genome.style.toLowerCase()}`}>
                {profile.genome.archetype}
              </span>
              <div className="tpm__assets">
                <span className="fx-mono">Top assets</span>
                <div>
                  {profile.genome.topAssets.map((asset) => (
                    <i key={asset} className="fx-mono">
                      {asset}
                    </i>
                  ))}
                </div>
              </div>
              <ul className="tpm__stats fx-mono">
                <li>
                  <span>Avg. hold time</span>
                  <strong>{profile.genome.avgHoldDays} days</strong>
                </li>
                <li>
                  <span>Win rate</span>
                  <strong>{profile.genome.winRate}%</strong>
                </li>
                <li>
                  <span>Realized PnL (90d)</span>
                  <strong className={profile.genome.pnlPct90d >= 0 ? "is-up" : "is-down"}>
                    {profile.genome.pnlPct90d >= 0 ? "+" : ""}
                    {profile.genome.pnlPct90d.toFixed(1)}%
                  </strong>
                </li>
                <li>
                  <span>Common counterparts</span>
                  <strong className="is-link">{profile.genome.similarWallets} similar wallets</strong>
                </li>
              </ul>
            </div>

            <div className="tpm__card tpm__card--radar">
              <RadarChart traits={profile.genome.traits} />
            </div>
          </div>
        </section>

        <section className="tpm__section">
          <div className="tpm__section-head">
            <h3>
              <span aria-hidden="true">🧠</span> Trader Mind Reader
            </h3>
            <p>Infer what they are thinking — not just what they bought.</p>
          </div>

          <div className="tpm__mind">
            <div className="tpm__card tpm__card--trade">
              <div className="tpm__card-top">
                <p className="tpm__card-label">Latest trade</p>
                <span className="fx-mono">{profile.mind.latestTrade.agoMin} min ago</span>
              </div>
              <div className="tpm__trade-main">
                <span className="tpm__trade-badge">{profile.mind.latestTrade.side}</span>
                <strong>{profile.mind.latestTrade.ticker}</strong>
                <em>{formatUsd(profile.mind.latestTrade.usd)}</em>
              </div>
              <ul className="tpm__kv fx-mono">
                <li>
                  <span>Price</span>
                  <strong>{profile.mind.latestTrade.price}</strong>
                </li>
                <li>
                  <span>Transaction size</span>
                  <strong>+{profile.mind.latestTrade.sizePct}% of supply</strong>
                </li>
                <li>
                  <span>Entry type</span>
                  <strong>{profile.mind.latestTrade.entryType}</strong>
                </li>
                <li>
                  <span>Network</span>
                  <strong>{profile.mind.latestTrade.network}</strong>
                </li>
              </ul>
            </div>

            <div className="tpm__card tpm__card--thesis">
              <p className="tpm__card-label">AI inferred thesis</p>
              <div className="tpm__thesis-box">
                <p>Why did @{profile.handle} buy {profile.mind.latestTrade.ticker}?</p>
                <ul>
                  {profile.mind.thesis.map((item) => (
                    <li key={item.text} className={`is-${item.tone}`}>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="tpm__thesis-foot fx-mono">
                Likely thesis: <strong>{profile.mind.likelyThesis}</strong>
              </p>
              <p className="tpm__confidence fx-mono">
                Confidence: <strong>{profile.mind.confidence}%</strong>
              </p>
            </div>

            <div className="tpm__card tpm__card--context">
              <p className="tpm__card-label">Context &amp; signals</p>
              <MiniCandles bullish={profile.mind.confidence >= 65} />
              <div className="tpm__signal-row fx-mono">
                <span>{profile.mind.signals.priceChange}</span>
                <span>{profile.mind.signals.smartWallets}</span>
                <span>{profile.mind.signals.volumeMultiple}</span>
                <span>{profile.mind.confidence}% confidence</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="tpm__footer">
          <p>
            <span aria-hidden="true">💡</span>
            You&apos;re not just tracking trades — you&apos;re inside the mind of the trader. Same wallets. Deeper
            insights.
          </p>
        </footer>
      </div>
    </div>
  );
}
