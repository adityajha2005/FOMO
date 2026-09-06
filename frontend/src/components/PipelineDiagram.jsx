/**
 * Data path for one scan: leaderboard in, ledger out. Drawn as a single SVG so the
 * stages and connectors hold their positions at any width.
 */
const TEXT = "#ffffff";
const DIM = "rgba(255,255,255,0.38)";
const LINE = "rgba(255,255,255,0.1)";
const ACCENT = "#df2531";
const SOFT = "rgba(223,37,49,0.65)";

const STAGES = [
  { x: 24, label: "fomoapi.io", sub: "leaderboard · alerts", note: "keyless + key" },
  { x: 196, label: "proxy", sub: "middleware · vite", note: "key stays server-side" },
  { x: 368, label: "gates", sub: "01 → 04", note: "all must pass", accent: SOFT },
  { x: 540, label: "sizer", sub: "conviction", note: "clamped to config", accent: SOFT },
  { x: 712, label: "executor", sub: "paper | live", note: "paper by default", accent: ACCENT },
];

export default function PipelineDiagram() {
  return (
    <div className="fx-pipe">
      <svg viewBox="0 0 900 250" role="img" aria-label="One scan: leaderboard in, ledger out">
        <text x="24" y="16" className="fx-pipe__cap" fill={DIM}>
          ONE SCAN · EVERY 20 SECONDS
        </text>

        {STAGES.map((stage, index) => (
          <g key={stage.label}>
            <rect
              x={stage.x}
              y="34"
              width="140"
              height="62"
              rx="4"
              fill="rgba(255,255,255,0.015)"
              stroke={stage.accent || LINE}
            />
            <text x={stage.x + 14} y="56" className="fx-pipe__label" fill={stage.accent || TEXT}>
              {stage.label}
            </text>
            <text x={stage.x + 14} y="72" className="fx-pipe__sub" fill={DIM}>
              {stage.sub}
            </text>
            <text x={stage.x + 14} y="88" className="fx-pipe__note" fill={DIM}>
              {stage.note}
            </text>

            {index < STAGES.length - 1 ? (
              <path
                d={`M${stage.x + 140} 65 L ${stage.x + 190} 65`}
                stroke={LINE}
                strokeWidth="1"
                markerEnd="url(#fx-arrow)"
              />
            ) : null}
          </g>
        ))}

        {/* skip path */}
        <path
          d="M438 96 C 438 140, 300 146, 220 146"
          fill="none"
          stroke={LINE}
          strokeWidth="1"
          strokeDasharray="3 4"
          markerEnd="url(#fx-arrow)"
        />
        <text x="228" y="150" className="fx-pipe__note" fill={DIM}>
          rejected → reason written to the event log, next wallet read
        </text>

        {/* ledger */}
        <rect x="540" y="176" width="312" height="52" rx="4" fill="rgba(255,255,255,0.015)" stroke={LINE} />
        <text x="556" y="198" className="fx-pipe__label" fill={TEXT}>
          data/fomo_cli.sqlite
        </text>
        <text x="556" y="216" className="fx-pipe__note" fill={DIM}>
          positions · events · marks — the only thing either surface reads
        </text>

        <path d="M782 96 L 782 172" stroke={LINE} strokeWidth="1" markerEnd="url(#fx-arrow)" />

        {/* consumers */}
        <rect x="24" y="176" width="180" height="52" rx="4" fill="rgba(255,255,255,0.015)" stroke={LINE} />
        <text x="40" y="198" className="fx-pipe__label" fill={TEXT}>
          terminal UI
        </text>
        <text x="40" y="216" className="fx-pipe__note" fill={DIM}>
          /app · flask :5123
        </text>

        <rect x="228" y="176" width="180" height="52" rx="4" fill="rgba(255,255,255,0.015)" stroke={LINE} />
        <text x="244" y="198" className="fx-pipe__label" fill={TEXT}>
          this page
        </text>
        <text x="244" y="216" className="fx-pipe__note" fill={DIM}>
          same snapshot, 5s poll
        </text>

        <path d="M536 202 L 412 202" stroke={LINE} strokeWidth="1" markerEnd="url(#fx-arrow)" />
        <path d="M224 202 L 208 202" stroke={LINE} strokeWidth="1" markerEnd="url(#fx-arrow)" />

        <defs>
          <marker id="fx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill={LINE} />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
