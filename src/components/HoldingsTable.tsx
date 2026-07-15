import { ChevronRight, Trash2 } from "lucide-react";
import type { MarketPoint, PositionMetrics } from "../types";
import { formatMoney, formatNumber, formatPercentInBrackets } from "../format";
import { HoldingSparkline } from "./HoldingSparkline";
import { StatusBadge } from "./StatusBadge";
import { InstrumentLogo } from "./InstrumentLogo";
import { useMediaQuery } from "./useMediaQuery";

const direction = (value: number | null) => value === null ? "neutral" : value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

function compactName(name: string) {
  return name
    .replace(/\s+[—-]\s+(?:Accumulating|EUR P Acc)$/i, "")
    .replace(/\s+UCITS ETF$/i, "")
    .replace(/\s+ETF$/i, "")
    .replace(/\s+EUR P Acc$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Props {
  positions: PositionMetrics[];
  loading: Set<string>;
  errors: Record<string, string>;
  sparklineHistory: (instrumentId: string) => MarketPoint[];
  onSelect: (position: PositionMetrics) => void;
  onDelete: (position: PositionMetrics) => void;
}

export function HoldingsTable({ positions, loading, errors, sparklineHistory, onSelect, onDelete }: Props) {
  const compact = useMediaQuery("(max-width: 1100px)");
  const countLabel = `${positions.length} ${positions.length === 1 ? "holding" : "holdings"}`;

  return <section className="holdings-section" aria-labelledby="holdings-title">
    <div className="section-heading"><div><p className="eyebrow">Positions</p><div className="holdings-title-line"><h2 id="holdings-title">Holdings</h2><span className="holdings-count" aria-label={`${countLabel} shown`}>{positions.length}</span></div></div></div>
    {compact
      ? <div className="holdings-cards">{positions.map((position) => <article className="holding-card" key={position.instrument.id}>
        <header>
          <button className="card-instrument" onClick={() => onSelect(position)} title={position.instrument.name}><InstrumentLogo instrument={position.instrument} /><span><strong>{position.instrument.ticker}</strong><small>{compactName(position.instrument.name)}</small></span></button>
          <StatusBadge quote={position.quote} loading={loading.has(position.instrument.id)} error={errors[position.instrument.id]} hideUpdated />
          <button type="button" className="icon-button holding-delete" aria-label={`Delete ${position.instrument.ticker} holding`} onClick={() => onDelete(position)}><Trash2 aria-hidden="true" /></button>
        </header>
        <button className="holding-overview" onClick={() => onSelect(position)}>
          <span className="sr-only">Open {position.instrument.ticker} details: </span>
          <span className="holding-performance">
            <strong className="holding-value">{position.currentValue === null ? "Unavailable" : formatMoney(position.currentValue, position.instrument.currency)}</strong>
            <span className={`return-chip ${direction(position.marketReturn)}`}>{position.marketReturn !== null && <span aria-hidden="true">{position.marketReturn >= 0 ? "▲" : "▼"} </span>}{formatMoney(position.marketReturn, position.instrument.currency)} <span>{formatPercentInBrackets(position.marketReturnPercentage)}</span></span>
            <span className={`holding-today ${direction(position.dailyChange)}`}>Today {formatMoney(position.dailyChange, position.instrument.currency)} <span>{formatPercentInBrackets(position.dailyChangePercentage)}</span></span>
          </span>
          <HoldingSparkline history={sparklineHistory(position.instrument.id)} ticker={position.instrument.ticker} />
        </button>
        <footer><span>{formatNumber(position.totalShares)} shares <b>|</b> {position.quote ? `${formatMoney(position.quote.price, position.instrument.currency)} each` : "price unavailable"}</span><button type="button" onClick={() => onSelect(position)}>Details <ChevronRight aria-hidden="true" /></button></footer>
      </article>)}</div>
      : <div className="table-shell holdings-desktop"><table>
        <thead><tr><th scope="col">Instrument</th><th scope="col">Shares</th><th scope="col">Price</th><th scope="col">Today</th><th scope="col">Invested</th><th scope="col">Value</th><th scope="col">Market Return</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{positions.map((position) => <tr key={position.instrument.id}>
          <td><button className="instrument-link" onClick={() => onSelect(position)} title={position.instrument.name}><InstrumentLogo instrument={position.instrument} /><span><strong>{position.instrument.ticker}</strong><small>{compactName(position.instrument.name)}</small></span></button></td>
          <td>{formatNumber(position.totalShares)}</td>
          <td><strong>{position.quote ? formatMoney(position.quote.price, position.instrument.currency) : "Unavailable"}</strong><StatusBadge quote={position.quote} loading={loading.has(position.instrument.id)} error={errors[position.instrument.id]} hideUpdated /></td>
          <td><span className={`change ${direction(position.dailyChange)}`}>{formatMoney(position.dailyChange, position.instrument.currency)}</span><small>{formatPercentInBrackets(position.dailyChangePercentage)}</small></td>
          <td>{formatMoney(position.purchaseCostExcludingFees, position.instrument.currency)}</td>
          <td>{formatMoney(position.currentValue, position.instrument.currency)}</td>
          <td><span className={`change ${direction(position.marketReturn)}`}>{position.marketReturn !== null && <span aria-hidden="true">{position.marketReturn >= 0 ? "▲" : "▼"} </span>}{formatMoney(position.marketReturn, position.instrument.currency)}</span><small>{formatPercentInBrackets(position.marketReturnPercentage)}</small></td>
          <td><div className="row-actions"><button className="icon-button" aria-label={`Open ${position.instrument.ticker} details`} onClick={() => onSelect(position)}><ChevronRight /></button><button className="icon-button danger" aria-label={`Delete ${position.instrument.ticker} holding`} onClick={() => onDelete(position)}><Trash2 /></button></div></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
