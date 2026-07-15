import { lazy, Suspense, useMemo, useState } from "react";
import { BarChart3, ChevronDown, LineChart } from "lucide-react";
import { buildPortfolioValueHistory, buildTimeWeightedReturnSeries, calculateMoneyWeightedReturn } from "../domain/portfolio";
import { formatMoney, formatPercent, formatPercentInBrackets } from "../format";
import type { ChartRange, MarketRecord, PositionMetrics } from "../types";
import type { PortfolioHistoryMode } from "./PortfolioHistoryChart";

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
  const [range, setRange] = useState<ChartRange>("1W");
  const [historyMode, setHistoryMode] = useState<PortfolioHistoryMode>("value");
  const basePositions = useMemo(() => positions.filter((position) => position.instrument.currency === baseCurrency), [positions, baseCurrency]);
  const allocation = useMemo(() => basePositions
    .filter((position) => position.currentValue !== null)
    .sort((left, right) => (right.currentValue ?? 0) - (left.currentValue ?? 0)), [basePositions]);
  const total = allocation.reduce((sum, position) => sum + (position.currentValue ?? 0), 0);
  const moneyWeightedReturn = useMemo(() => calculateMoneyWeightedReturn(basePositions), [basePositions]);
  const histories = Object.fromEntries(basePositions.map((position) => [position.instrument.id, getRecord(position.instrument.id, range)?.history ?? []]));
  const complete = basePositions.length > 0 && basePositions.every((position) => histories[position.instrument.id]?.length);
  const history = useMemo(() => complete ? buildPortfolioValueHistory(basePositions, histories, baseCurrency) : [], [complete, basePositions, histories, baseCurrency]);
  const returnHistory = useMemo(() => buildTimeWeightedReturnSeries(history), [history]);
  const excluded = basePositions.filter((position) => position.currentValue === null);
  const latest = history.at(-1);
  const first = history[0];
  const change = latest && first ? latest.marketValue - first.marketValue : null;
  const changePercent = change !== null && first && first.marketValue > 0 ? change / first.marketValue * 100 : null;
  const latestReturn = returnHistory.at(-1)?.returnPercentage ?? null;

  function selectRange(next: ChartRange) {
    setRange(next);
    onRange(next);
  }

  return <details className="portfolio-insights" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span><BarChart3 aria-hidden="true" /><span><strong>Portfolio Insights</strong><small>Allocation and portfolio history</small></span></span><ChevronDown className="insights-chevron" aria-hidden="true" /></summary>
    {open && <div className="insights-body">
      <section className="allocation-panel" aria-labelledby="allocation-title">
        <div className="insight-heading"><div><p className="eyebrow">Allocation</p><h3 id="allocation-title">Current Value by Holding</h3></div><strong>{formatMoney(total, baseCurrency)}</strong></div>
        <div className="annualised-return"><span>Annualised Return</span><strong className={moneyWeightedReturn !== null ? (moneyWeightedReturn.percentage < 0 ? "negative-text" : "positive-text") : undefined}>{moneyWeightedReturn !== null ? formatPercent(moneyWeightedReturn.percentage) : "Not Enough History"}</strong><small>Cash-flow weighted · Before fees</small></div>
        <p className="allocation-coverage">{allocation.length}/{basePositions.length} {baseCurrency} holdings priced{excluded.length ? ` · Excludes ${excluded.map((position) => position.instrument.ticker).join(", ")}` : ""}</p>
        <div className="allocation-bars">{allocation.map((position) => {
          const percentage = total > 0 ? (position.currentValue ?? 0) / total * 100 : 0;
          return <div className="allocation-row" key={position.instrument.id}>
            <div><strong>{position.instrument.ticker}</strong><span>{formatMoney(position.currentValue, baseCurrency)} · {percentage.toFixed(1)}%</span></div>
            <div className="allocation-track" role="img" aria-label={`${position.instrument.ticker}: ${percentage.toFixed(1)}% of current portfolio value`}><span style={{ width: `${percentage}%` }} /></div>
          </div>;
        })}</div>
      </section>

      <section className="portfolio-history" aria-labelledby="portfolio-history-title">
        <div className="portfolio-history-heading"><LineChart aria-hidden="true" /><strong id="portfolio-history-title">Portfolio History</strong></div>
        <div className="portfolio-history-body">
          <div className="portfolio-history-controls"><div className="view-controls portfolio-view-controls" role="group" aria-label="Portfolio history view"><button type="button" className={historyMode === "value" ? "active" : ""} aria-pressed={historyMode === "value"} onClick={() => setHistoryMode("value")}>Value</button><button type="button" className={historyMode === "return" ? "active" : ""} aria-pressed={historyMode === "return"} onClick={() => setHistoryMode("return")}>Return</button></div><div className="range-controls" aria-label="Portfolio history range">{ranges.map((item) => <button key={item} className={item === range ? "active" : ""} aria-pressed={item === range} onClick={(event) => { event.preventDefault(); selectRange(item); }}>{item}</button>)}</div></div>
          {!complete ? <div className="insight-empty">Complete historical prices are not available for every holding in this range.</div> : !history.length ? <div className="insight-empty">Portfolio history begins after your first order.</div> : <>
            <p className="portfolio-history-summary">{historyMode === "value" ? <>Latest {formatMoney(latest?.marketValue ?? null)}<span className="summary-separator" aria-hidden="true">|</span>Change {formatMoney(change)} {formatPercentInBrackets(changePercent)}</> : <>Market Return {formatPercent(latestReturn)}<span className="summary-separator" aria-hidden="true">|</span>{formatMoney((latest?.marketValue ?? 0) - (latest?.investedValue ?? 0))} Before Fees</>}</p>
            <p className="cash-flow-note">Value includes purchases and deposits. Return chains market performance while removing new-order cash flows.</p>
            <Suspense fallback={<div className="chart-empty chart-skeleton" role="status">Loading Portfolio Chart…</div>}><PortfolioHistoryChart points={history} mode={historyMode} /></Suspense>
          </>}
        </div>
      </section>
    </div>}
  </details>;
}
