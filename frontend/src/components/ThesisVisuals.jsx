/**
 * Minimal line diagrams for the thesis section. All labels live in HTML so the
 * type never scales with the SVG box.
 */
const VIO = "#a855f7";
const SOFT = "#c4b5fd";
const UP = "#4ade80";
const FAINT = "rgba(255,255,255,0.14)";

const BOX = { viewBox: "0 0 200 76", preserveAspectRatio: "xMidYMid meet" };

function Frame({ children }) {
  return (
    <svg {...BOX} aria-hidden="true">
      {children}
    </svg>
  );
}

/** 122 wallets on the board, only the leading 30 are followed. */
function Top30Ranks() {
  const ticks = 26;

  return (
    <Frame>
      <line x1="12" y1="58" x2="188" y2="58" stroke={FAINT} />
      {Array.from({ length: ticks }, (_, index) => {
        const active = index < 8;
        const x = 12 + index * 7;
        const height = active ? 12 + index * 3.2 : 6;
        return (
          <line
            key={index}
            x1={x}
            y1="58"
            x2={x}
            y2={58 - height}
            stroke={active ? VIO : "rgba(255,255,255,0.16)"}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
      <path d="M10 20 V14 H70 V20" fill="none" stroke={SOFT} strokeWidth="1.2" />
    </Frame>
  );
}

/** Each runner stacks onto the cumulative curve. */
function CompoundCurve() {
  const points = [
    [16, 60],
    [60, 50],
    [104, 36],
    [148, 26],
    [186, 14],
  ];

  return (
    <Frame>
      <line x1="12" y1="62" x2="188" y2="62" stroke={FAINT} />
      <polyline
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={SOFT}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], index) => (
        <circle key={x} cx={x} cy={y} r="3" fill={index === points.length - 1 ? UP : VIO} />
      ))}
    </Frame>
  );
}

/** Audience trails the wallet that is performing. */
function AudienceTrail() {
  const trail = [
    [22, 58, 2],
    [52, 53, 2.4],
    [82, 45, 2.8],
    [112, 37, 3.2],
    [142, 28, 3.6],
  ];

  return (
    <Frame>
      <path d="M18 60 Q 96 52 182 18" fill="none" stroke={FAINT} strokeWidth="1.2" />
      {trail.map(([x, y, r], index) => (
        <circle key={x} cx={x} cy={y} r={r} fill={VIO} opacity={0.35 + index * 0.13} />
      ))}
      <circle cx="180" cy="20" r="7" fill="none" stroke={UP} strokeWidth="1.4" />
      <circle cx="180" cy="20" r="3" fill={UP} />
    </Frame>
  );
}

/** Behavioural profile scored across five axes. */
function GenomeRadar() {
  const cx = 100;
  const cy = 38;
  const axes = 5;

  function polygon(scale, values) {
    return Array.from({ length: axes }, (_, index) => {
      const angle = (Math.PI * 2 * index) / axes - Math.PI / 2;
      const radius = 28 * scale * (values ? values[index] : 1);
      return `${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`;
    }).join(" ");
  }

  return (
    <Frame>
      <polygon points={polygon(1)} fill="none" stroke={FAINT} strokeWidth="1" />
      <polygon points={polygon(0.55)} fill="none" stroke={FAINT} strokeWidth="1" />
      <polygon
        points={polygon(1, [0.85, 0.62, 0.9, 0.45, 0.7])}
        fill="rgba(168,85,247,0.18)"
        stroke={SOFT}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/** Several followed wallets must agree before size goes in. */
function ConfluenceNodes() {
  const sources = [
    [30, 20],
    [30, 38],
    [30, 56],
  ];

  return (
    <Frame>
      {sources.map(([x, y]) => (
        <path key={y} d={`M${x + 8} ${y} Q 105 ${y} 152 38`} fill="none" stroke={FAINT} strokeWidth="1.2" />
      ))}
      {sources.map(([x, y]) => (
        <circle key={`dot-${y}`} cx={x} cy={y} r="4.5" fill="none" stroke={VIO} strokeWidth="1.5" />
      ))}
      <circle cx="160" cy="38" r="9" fill="rgba(74,222,128,0.16)" stroke={UP} strokeWidth="1.5" />
      <circle cx="160" cy="38" r="3" fill={UP} />
    </Frame>
  );
}

/** Participate in every major move of the cycle. */
function RunnerPeaks() {
  const peaks = [
    [16, 58],
    [44, 34],
    [72, 48],
    [100, 26],
    [128, 40],
    [156, 18],
    [186, 30],
  ];

  return (
    <Frame>
      <line x1="12" y1="62" x2="188" y2="62" stroke={FAINT} />
      <polyline
        points={peaks.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={SOFT}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[1, 3, 5].map((index) => (
        <circle key={index} cx={peaks[index][0]} cy={peaks[index][1]} r="3.2" fill={index === 5 ? UP : VIO} />
      ))}
    </Frame>
  );
}

const VISUALS = {
  top30: Top30Ranks,
  compound: CompoundCurve,
  audience: AudienceTrail,
  analysis: GenomeRadar,
  confluence: ConfluenceNodes,
  runners: RunnerPeaks,
};

export const THESIS_VISUAL_BLOCKS = [
  {
    id: "top30",
    metric: "30 / 122",
    title: "Top 30, not 122",
    caption: "Only the leading wallets are followed. Fall off the board, fall out of the set.",
  },
  {
    id: "compound",
    metric: "$7M → $45M",
    title: "Gains compound",
    caption: "Every runner adds to the cumulative PnL the leaderboard carries forward.",
  },
  {
    id: "audience",
    metric: "550K in 2 months",
    title: "Audience follows performance",
    caption: "Attention trails the wallets that are actually winning.",
  },
  {
    id: "analysis",
    metric: "5 scored axes",
    title: "Analysis, not copying",
    caption: "Style, hold time, and thesis hit-rate decide whether a trade is worth taking.",
  },
  {
    id: "confluence",
    metric: "3+ wallets",
    title: "Confluence over noise",
    caption: "One wallet is a signal. Several agreeing is a position.",
  },
  {
    id: "runners",
    metric: "every cycle",
    title: "Every major runner",
    caption: "Accumulate ahead of the moves instead of chasing them after the fact.",
  },
];

export function ThesisVisual({ id }) {
  const Visual = VISUALS[id];
  return Visual ? <Visual /> : null;
}

function WinnersCurve() {
  return (
    <svg viewBox="0 0 160 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line x1="12" y1="48" x2="148" y2="48" stroke={FAINT} />
      <polyline
        points="16,44 48,36 80,26 112,18 144,8"
        fill="none"
        stroke={UP}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="144" cy="8" r="3.5" fill={UP} />
    </svg>
  );
}

function FlippersCurve() {
  return (
    <svg viewBox="0 0 160 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line x1="12" y1="48" x2="148" y2="48" stroke={FAINT} />
      <polyline
        points="16,30 40,20 64,34 88,22 112,36 144,28"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="144" cy="28" r="3.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

export function ThesisPullQuote() {
  return (
    <div className="thesis__pull-inner">
      <div className="thesis__compare">
        <article className="thesis__compare-side is-winners">
          <p className="thesis__compare-label fx-mono">Winners</p>
          <div className="thesis__compare-viz">
            <WinnersCurve />
          </div>
          <p className="thesis__compare-note">Hold through the move and accumulate the 8- and 9-figure names.</p>
        </article>

        <span className="thesis__compare-vs fx-mono" aria-hidden="true">
          vs
        </span>

        <article className="thesis__compare-side is-flippers">
          <p className="thesis__compare-label fx-mono">Flippers</p>
          <div className="thesis__compare-viz">
            <FlippersCurve />
          </div>
          <p className="thesis__compare-note">In fast, out faster — plenty of trades, no position when it matters.</p>
        </article>
      </div>

      <p className="thesis__pull-line">
        We bet on <strong>winners</strong>, not <span>flippers</span>.
      </p>
    </div>
  );
}
