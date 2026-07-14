import { lazy, Suspense, useMemo, useState } from "react";
import { BarChart3, ChevronDown, LineChart } from "lucide-react";
import { buildPortfolioValueHistory } from "../domain/portfolio";
import { formatMoney, formatPercent } from "../format";
import type { ChartRange, MarketRecord, PositionMetrics } from "../types";

const PortfolioHistoryChart = lazy(() => import("./PortfolioHistoryChart").then((module) => ({ default: module.PortfolioHistoryChart })));
const ranges: ChartRange[] = ["1W", "1M", "3M", "1Y", "MAX"];

interface Props {
  positions: PositionMetrics[];
  baseCurrency: string;
  getRecord: (instrumentId: string, range: ChartRange) => MarketRecord | null;
  onRange: (range: ChartRange) => void;
}

export function PortfolioInsights({ positions, baseCurrency, getRecord, onRange }: Props) {
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [range, setRange] = useState<ChartRange>("1W");
  const basePositions = useMemo(() => positions.filter((position) => position.instrument.currency === baseCurrency), [positions, baseCurrency]);
  const allocation = useMemo(() => basePositions
    .filter((position) => position.currentValue !== null)
    .sort((left, right) => (right.currentValue ?? 0) - (left.currentValue ?? 0)), [basePositions]);
  const total = allocation.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
  const histories = Object.fromEntries(basePositions.map((position) => [position.instrument.id, getRecord(position.instrument.id, range)?.history ?? []]));
  const complete = basePositions.length > 0 && basePositions.every((position) => histories[position.instrument.id]?.length);
  const history = useMemo(() => complete ? buildPortfolioValueHistory(basePositions, histories, baseCurrency) : [], [complete, basePositions, histories, baseCurrency]);
  const excluded = basePositions.filter((position) => position.currentValue === null);
  const latest = history.at(-1);
  const first = history[0];
  const change = latest && first ? latest.marketValue - first.marketValue : null;
  const changePercent = change !== null && first && first.marketValue > 0 ? change / first.marketValue * 100 : null;

  function selectRange(next: ChartRange) {
    setRange(next);
    onRange(next);
  }

  return <details className="portfolio-insights" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span><BarChart3 aria-hidden="true" /><span><strong>Portfolio Insights</strong><small>Allocation and portfolio history</small></span></span><ChevronDown className="insights-chevron" aria-hidden="true" /></summary>
    {open && <div className="insights-body">
      <section className="allocation-panel" aria-labelledby="allocation-title">
        <div className="insight-heading"><div><p className="eyebrow">Allocation</p><h3 id="allocation-title">Current Value by Holding</h3></div><strong>{formatMoney(total, baseCurrency)}</strong></div>
        <p className="allocation-coverage">{allocation.length}/{basePositions.length} {baseCurrency} holdings priced{excluded.length ? ` · Excludes ${excluded.map((position) => position.instrument.ticker).join(", ")}` : ""}</p>
        <div className="allocation-bars">{allocation.map((position) => {
          const percentage = total > 0 ? (position.currentValue ?? 0) / total * 100 : 0;
          return <div className="allocation-row" key={position.instrument.id}>
            <div><strong>{position.instrument.ticker}</strong><span>{formatMoney(position.currentValue, baseCurrency)} · {percentage.toFixed(1)}%</span></div>
            <div className="allocation-track" role="img" aria-label={`${position.instrument.ticker}: ${percentage.toFixed(1)}% of current portfolio value`}><span style={{ width: `${percentage}%` }} /></div>
          </div>;
        })}</div>
      </section>

      <details className="portfolio-history" open={historyOpen} onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
        <summary><span><LineChart aria-hidden="true" /><strong>Portfolio Value History</strong></span><ChevronDown aria-hidden="true" /></summary>
        {historyOpen && <div className="portfolio-history-body">
          <div className="range-controls" aria-label="Portfolio history range">{ranges.map((item) => <button key={item} className={item === range ? "active" : ""} aria-pressed={item === range} onClick={(event) => { event.preventDefault(); selectRange(item); }}>{item}</button>)}</div>
          {!complete ? <div className="insight-empty">Complete historical prices are not available for every holding in this range.</div> : !history.length ? <div className="insight-empty">Portfolio history begins after your first order.</div> : <>
            <p className="portfolio-history-summary">Latest {formatMoney(latest?.marketValue ?? null)} · Change {formatMoney(change)} {formatPercent(changePercent)}</p>
            <Suspense fallback={<div className="chart-empty chart-skeleton" role="status">Loading Portfolio Chart…</div>}><PortfolioHistoryChart points={history} /></Suspense>
          </>}
        </div>}
      </details>
    </div>}
  </details>;
}
