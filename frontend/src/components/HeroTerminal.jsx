import { useEffect, useRef, useState } from "react";

/** Real shape of `python -m fomo_cli copy` output, replayed line by line. */
const LINES = [
  { tag: "boot", name: "follow set", text: "30 wallets · window 24h · chains solana, base, bsc, eth, rh" },
  { tag: "boot", name: "sizing", text: "conviction · base 2% · max 6% · min $10 · max_open 6" },
  { tag: "boot", name: "mode", text: "paper — fills marked at live DexScreener quotes" },
  { tag: "scan", name: "tick 20s", text: "reading tape for 30 wallets" },
  { tag: "skip", name: "$LIGMA", text: "liquidity $12,400 < floor $20,000" },
  { tag: "skip", name: "$BUTT", text: "top-10 holders 61% > cap 45%" },
  { tag: "gate", name: "$ROBIN", text: "tape 5m buys 148 > sells 96 · 1h buys ≥ sells" },
  { tag: "size", name: "$ROBIN", text: "1,000 × 2% × M 1.5 × c 1.35 × 1.28 × H 1.22 = $63.28" },
  { tag: "fill", name: "$ROBIN", text: "$63.28 @ 0.00041 · pos #7 · copied @damsizdayl" },
  { tag: "exit", name: "$ALBUS", text: "+41.2% take · +$18.04 realized · held 2.4h" },
  { tag: "scan", name: "tick 20s", text: "6 open · 24h pnl +$29.65 · stop 8% not hit" },
];

export default function HeroTerminal() {
  const [shown, setShown] = useState(1);
  const bodyRef = useRef(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setShown((count) => (count >= LINES.length ? 1 : count + 1));
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const node = bodyRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [shown]);

  return (
    <div className="fx-term" aria-hidden="true">
      <div className="fx-term__bar">
        <span className="fx-term__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="fx-mono fx-term__title">fomo_cli — copy — paper</span>
        <span className="fx-mono fx-term__badge">live</span>
      </div>

      <div className="fx-term__body" ref={bodyRef}>
        <p className="fx-mono fx-term__cmd">
          <span>$</span> python -m fomo_cli copy
        </p>

        {LINES.slice(0, shown).map((line, index) => (
          <p key={`${line.tag}-${index}`} className={`fx-mono fx-term__line is-${line.tag}`}>
            <em>[{line.tag}]</em>
            <b>{line.name}</b>
            <span>{line.text}</span>
          </p>
        ))}

        <p className="fx-mono fx-term__caret">
          <span>$</span>
          <i />
        </p>
      </div>
    </div>
  );
}
