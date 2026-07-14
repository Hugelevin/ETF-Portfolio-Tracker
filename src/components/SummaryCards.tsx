import { ArrowDownRight, ArrowUpRight, CircleDollarSign, Gauge, Landmark } from "lucide-react";
import type { PortfolioSummary, PositionMetrics } from "../types";
import { formatMoney, formatPercent, formatUpdateAge } from "../format";

const tone = (value: number | null) => value !== null && value > 0 ? "positive" : value !== null && value < 0 ? "negative" : "neutral";

export function SummaryCards({ summary, positions, updatedAt }: { summary: PortfolioSummary; positions: PositionMetrics[]; updatedAt: string | null }) {
  const incomplete = summary.pricedPositions !== summary.totalPositions;
  const missing = positions.filter((position) => summary.missingPricePositionIds.includes(position.instrument.id));
  const nonEur = positions.filter((position) => summary.nonBaseCurrencyPositionIds.includes(position.instrument.id));
  return <section className="summary" aria-labelledby="summary-title">
    <div className="summary-heading">
      <div><p className="eyebrow">Portfolio Overview</p><h2 id="summary-title">Your EUR Portfolio</h2></div>
      <div className="summary-status"><span className={`coverage ${incomplete ? "warning" : ""}`} aria-label={`${summary.pricedPositions} of ${summary.baseCurrencyPositions} EUR positions valued`}>{summary.pricedPositions}/{summary.baseCurrencyPositions} Priced{nonEur.length ? ` · ${nonEur.length} Non-EUR` : ""}</span><small>{formatUpdateAge(updatedAt)}</small></div>
    </div>
    <div className="summary-grid">
      <article className="metric-card primary"><div className="metric-label"><CircleDollarSign aria-hidden="true" /><p>Current Value</p></div><strong>{summary.pricedPositions ? formatMoney(summary.currentValue) : "Unavailable"}</strong><small>{incomplete ? "Partial Total" : "All EUR Positions"}</small></article>
      <article className={`metric-card ${tone(summary.marketReturn)}`}><div className="metric-label">{summary.marketReturn >= 0 ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownRight aria-hidden="true" />}<p>Market Return</p></div><strong>{summary.pricedPositions ? formatMoney(summary.marketReturn) : "Unavailable"}</strong><small>{summary.pricedPositions ? `${formatPercent(summary.marketReturnPercentage)} - Before Fees` : "No Valued Positions"}</small></article>
      <article className={`metric-card ${tone(summary.dailyChange)}`}><div className="metric-label"><Gauge aria-hidden="true" /><p>Today</p></div><strong>{formatMoney(summary.dailyChange)}</strong><small>{summary.dailyChangePositions ? `${summary.dailyChangePositions} Positions` : "Unavailable"}</small></article>
      <article className="metric-card"><div className="metric-label"><Landmark aria-hidden="true" /><p>Invested</p></div><strong>{formatMoney(summary.totalInvested)}</strong><small>Fees: {formatMoney(summary.totalFees)}</small></article>
    </div>
    {(missing.length > 0 || nonEur.length > 0) && <div className="exclusion-note" role="status"><strong>Excluded from combined current value:</strong> {missing.map((position) => `${position.instrument.ticker} (price unavailable)`).concat(nonEur.map((position) => `${position.instrument.ticker} (${position.instrument.currency}, no FX conversion)`)).join(" · ")}</div>}
  </section>;
}
