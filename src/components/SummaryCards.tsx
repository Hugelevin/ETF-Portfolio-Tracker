import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Gauge, Landmark } from "lucide-react";
import type { PortfolioSummary, PositionMetrics } from "../types";
import { formatMoney, formatPercent } from "../format";

const tone = (value: number | null) => value !== null && value > 0 ? "positive" : value !== null && value < 0 ? "negative" : "neutral";

export function SummaryCards({ summary, positions }: { summary: PortfolioSummary; positions: PositionMetrics[] }) {
  const incomplete = summary.pricedPositions !== summary.totalPositions;
  const missing = positions.filter((position) => summary.missingPricePositionIds.includes(position.instrument.id));
  const nonEur = positions.filter((position) => summary.nonBaseCurrencyPositionIds.includes(position.instrument.id));
  return <section className="summary" aria-labelledby="summary-title">
    <div className="summary-heading">
      <div><p className="eyebrow">Portfolio Overview</p><h2 id="summary-title">Your EUR Portfolio</h2></div>
      <span className={`coverage ${incomplete ? "warning" : ""}`}>{summary.pricedPositions} of {summary.baseCurrencyPositions} EUR positions valued{nonEur.length ? ` · ${nonEur.length} non-EUR separate` : ""}</span>
    </div>
    <div className="summary-grid">
      <article className="metric-card"><span className="metric-icon"><Landmark aria-hidden="true" /></span><p>Total Invested</p><strong>{formatMoney(summary.totalInvested)}</strong><small>Broker Fees Paid Separately: {formatMoney(summary.totalFees)}</small></article>
      <article className="metric-card primary"><span className="metric-icon"><CircleDollarSign aria-hidden="true" /></span><p>Current Value</p><strong>{summary.pricedPositions ? formatMoney(summary.currentValue) : "Unavailable"}</strong><small>{incomplete ? "Partial Total - Excludes Unavailable Prices" : "All EUR Positions Included"}</small></article>
      <article className={`metric-card ${tone(summary.marketReturn)}`}><span className="metric-icon">{summary.marketReturn >= 0 ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownRight aria-hidden="true" />}</span><p>Market Return</p><strong>{summary.pricedPositions ? formatMoney(summary.marketReturn) : "Unavailable"}</strong><small>{summary.pricedPositions ? `${formatPercent(summary.marketReturnPercentage)} - Excludes Broker Fees` : "No Valued Positions"}</small></article>
      <article className={`metric-card ${tone(summary.dailyChange)}`}><span className="metric-icon"><Gauge aria-hidden="true" /></span><p>Daily Change</p><strong>{formatMoney(summary.dailyChange)}</strong><small>{summary.dailyChangePositions ? `${summary.dailyChangePositions} of ${summary.pricedPositions} Valued Positions` : "Daily Movement Unavailable"}</small></article>
    </div>
    {(missing.length > 0 || nonEur.length > 0) && <div className="exclusion-note" role="status"><strong>Excluded from combined current value:</strong> {missing.map((position) => `${position.instrument.ticker} (price unavailable)`).concat(nonEur.map((position) => `${position.instrument.ticker} (${position.instrument.currency}, no FX conversion)`)).join(" · ")}</div>}
  </section>;
}
