import { ChevronRight, Trash2 } from "lucide-react";
import type { PositionMetrics } from "../types";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "../format";
import { StatusBadge } from "./StatusBadge";

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
        <thead><tr><th scope="col">Instrument</th><th scope="col">Shares / units</th><th scope="col">Price / rate</th><th scope="col">Invested</th><th scope="col">Value</th><th scope="col">Return</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{positions.map((position) => <tr key={position.instrument.id}>
          <td data-label="Instrument"><button className="instrument-link" onClick={() => onSelect(position)}><span className="ticker-mark">{position.instrument.ticker.slice(0, 4)}</span><span><strong>{position.instrument.ticker}</strong><small>{position.instrument.name}</small><em>{position.instrument.isin} · {position.instrument.exchange}</em></span></button></td>
          <td data-label="Shares / units">{formatNumber(position.totalShares)}</td>
          <td data-label="Price / rate">{position.instrument.assetType === "FUND" ? position.instrument.annualYieldPercentage === undefined ? <><strong>Unavailable</strong><span className="status unavailable">APY required</span></> : <><strong>{formatNumber(position.instrument.annualYieldPercentage)}% APY</strong>{position.dailyChange !== null && <small className={`today-change ${direction(position.dailyChange)}`}>Today {position.dailyChange >= 0 ? "▲" : "▼"} {formatMoney(position.dailyChange, position.instrument.currency)} · {formatPercent(position.dailyChangePercentage)}</small>}<span className="status available">Estimated daily accrual</span></> : <><strong>{position.quote ? formatMoney(position.quote.price, position.instrument.currency) : "Unavailable"}</strong>{position.dailyChange !== null && <small className={`today-change ${direction(position.dailyChange)}`}>Today {position.dailyChange >= 0 ? "▲" : "▼"} {formatMoney(position.dailyChange, position.instrument.currency)} · {formatPercent(position.dailyChangePercentage)}</small>}<StatusBadge quote={position.quote} loading={loading.has(position.instrument.id)} error={errors[position.instrument.id]} />{position.quote && <small className="timestamp">As at {formatDateTime(position.quote.asOf)}</small>}</>}</td>
          <td data-label="Invested">{formatMoney(position.totalCost, position.instrument.currency)}</td>
          <td data-label="Value">{formatMoney(position.currentValue, position.instrument.currency)}</td>
          <td data-label="Return"><span className={`change ${direction(position.profitLoss)}`}>{position.profitLoss !== null && <span aria-hidden="true">{position.profitLoss >= 0 ? "▲" : "▼"} </span>}{formatMoney(position.profitLoss, position.instrument.currency)}</span><small>{formatPercent(position.profitLossPercentage)}</small></td>
          <td data-label="Actions"><div className="row-actions"><button className="icon-button" aria-label={`Open ${position.instrument.ticker} details`} onClick={() => onSelect(position)}><ChevronRight /></button><button className="icon-button danger" aria-label={`Delete ${position.instrument.ticker} holding`} onClick={() => onDelete(position)}><Trash2 /></button></div></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
