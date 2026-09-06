import { useEffect, useMemo, useRef } from "react";
import { useCopyTrader } from "../hooks/useCopyTrader.js";
import { formatAlertTime, formatPnl, formatPercent, formatUsd } from "../utils/format.js";

function formatEventText(text) {
  if (!text) {
    return "";
  }
  return text.replace(/\s+\{.*\}$/, "");
}

function eventLine(event) {
  const time = formatAlertTime(event.ts);
  const text = formatEventText(event.text);

  if (event.kind === "buy") {
    return { time, text: `BUY ${text}`, tone: "buy" };
  }
  if (event.kind === "sell") {
    const positive = text.includes("pnl $+") || text.includes("pnl +$");
    return { time, text: `SELL ${text}`, tone: positive ? "profit" : "loss" };
  }
  if (event.kind === "scale") {
    return { time, text: `SCALE ${text}`, tone: "scale" };
  }
  if (event.kind === "pause") {
    return { time, text: `PAUSE ${text}`, tone: "warn" };
  }
  return { time, text, tone: "dim" };
}

function positionLine(position) {
  const pnl = position.status === "open" ? position.unrealized_pnl : position.pnl_usd;
  const sign = Number(pnl) >= 0 ? "+" : "";
  return `#${position.id} ${position.token} $${position.usd_in.toFixed(0)} via @${position.handle} ${sign}$${Math.abs(Number(pnl) || 0).toFixed(2)}`;
}

export default function CopyTraderCli({ refreshKey = 0 }) {
  const { data, loading, error, connected } = useCopyTrader({ refreshKey });
  const logRef = useRef(null);

  const lines = useMemo(() => {
    const output = [];

    if (data.stats) {
      const { roi_pct, total_pnl, open_count, closed_trades, session_hours } = data.stats;
      output.push({
        tone: "header",
        text: `ROI ${formatPercent(roi_pct)} | PnL ${formatPnl(total_pnl)} | ${open_count} open / ${closed_trades} closed | ${session_hours.toFixed(1)}h`,
      });
    }

    for (const position of data.open_positions) {
      output.push({ tone: "position", text: `OPEN ${positionLine(position)}` });
    }

    for (const event of data.events) {
      output.push(eventLine(event));
    }

    if (!output.length) {
      output.push({ tone: "dim", text: "Waiting for copy-trader signals…" });
    }

    return output;
  }, [data]);

  useEffect(() => {
    const node = logRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [lines.length, data.updated_at]);

  return (
    <section className="copy-trader-cli">
      <div className="copy-trader-cli__header">
        <div className="copy-trader-cli__title">
          <span className={`copy-trader-cli__dot ${connected ? "live" : ""}`} />
          copy-trader
          <span className="copy-trader-cli__mode">{data.mode}</span>
        </div>
        <span className="copy-trader-cli__account num">{formatUsd(data.account_usd, { compact: true })}</span>
      </div>

      <div className="copy-trader-cli__body" ref={logRef}>
        {loading && !data.stats ? <div className="copy-trader-cli__line dim">Connecting…</div> : null}
        {error ? <div className="copy-trader-cli__line warn">! {error}</div> : null}
        {lines.map((line, index) => (
          <div key={`${line.text}-${index}`} className={`copy-trader-cli__line ${line.tone || "dim"}`}>
            {line.time ? <span className="copy-trader-cli__time">{line.time}</span> : null}
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
