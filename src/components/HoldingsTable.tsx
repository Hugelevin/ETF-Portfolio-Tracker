import { ChevronRight, Trash2 } from "lucide-react";
import type { PositionMetrics } from "../types";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "../format";
import { StatusBadge } from "./StatusBadge";
import { InstrumentLogo } from "./InstrumentLogo";

const direction = (value: number | null) => value === null ? "neutral" : value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

interface Props {
  positions: PositionMetrics[];
  loading: Set<string>;
  errors: Record<string, string>;
  onSelect: (position: PositionMetrics) => void;
  onDelete: (position: PositionMetrics) => void;
}

export function HoldingsTable({ positions, loading, errors, onSelect, onDelete }: Props) {
  return <section className="holdings-section" aria-labelledby="holdings-title">
    <div className="section-heading"><div><p className="eyebrow">Positions</p><h2 id="holdings-title">Holdings</h2></div><p>{positions.length} {positions.length === 1 ? "instrument" : "instruments"}</p></div>
    <div className="table-shell">
      <table>
        <thead><tr><th scope="col">Instrument</th><th scope="col">Shares</th><th scope="col">Price / NAV</th><th scope="col">Invested</th><th scope="col">Value</th><th scope="col">Market Return</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{positions.map((position) => <tr key={position.instrument.id}>
          <td data-label="Instrument"><button className="instrument-link" onClick={() => onSelect(position)}><InstrumentLogo instrument={position.instrument} /><span><strong>{position.instrument.ticker}</strong><small>{position.instrument.name}</small><em>{position.instrument.isin} · {position.instrument.exchange}</em></span></button></td>
          <td data-label="Shares">{formatNumber(position.totalShares)}</td>
          <td data-label="Price / NAV"><strong>{position.quote ? formatMoney(position.quote.price, position.instrument.currency) : "Unavailable"}</strong>{position.dailyChange !== null && <small className={`today-change ${direction(position.dailyChange)}`}>Today {position.dailyChange >= 0 ? "▲" : "▼"} {formatMoney(position.dailyChange, position.instrument.currency)} · {formatPercent(position.dailyChangePercentage)}</small>}{position.costBasisWarning ? <span className="status stale">Review Cost Basis</span> : <StatusBadge quote={position.quote} loading={loading.has(position.instrument.id)} error={errors[position.instrument.id]} />}{position.quote && <small className="timestamp">As at {formatDateTime(position.quote.asOf)}</small>}{position.costBasisWarning && <small className="cost-basis-warning">Re-import the corrected portfolio JSON.</small>}</td>
          <td data-label="Invested">{formatMoney(position.totalCost, position.instrument.currency)}{position.totalFees > 0 && <small className="fee-context">Includes {formatMoney(position.totalFees, position.instrument.currency)} Fees</small>}</td>
          <td data-label="Value">{formatMoney(position.currentValue, position.instrument.currency)}</td>
          <td data-label="Market Return"><span className={`change ${direction(position.marketReturn)}`}>{position.marketReturn !== null && <span aria-hidden="true">{position.marketReturn >= 0 ? "▲" : "▼"} </span>}{formatMoney(position.marketReturn, position.instrument.currency)}</span><small>{formatPercent(position.marketReturnPercentage)}</small>{position.totalFees > 0 && <small className="net-return">Net After Fees: {formatMoney(position.profitLoss, position.instrument.currency)}</small>}</td>
          <td data-label="Actions"><div className="row-actions"><button className="icon-button" aria-label={`Open ${position.instrument.ticker} details`} onClick={() => onSelect(position)}><ChevronRight /></button><button className="icon-button danger" aria-label={`Delete ${position.instrument.ticker} holding`} onClick={() => onDelete(position)}><Trash2 /></button></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
