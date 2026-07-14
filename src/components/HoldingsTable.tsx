import { useMemo, useState } from "react";
import { ChevronRight, MoreHorizontal, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import type { PositionMetrics } from "../types";
import { formatMoney, formatNumber, formatPercent } from "../format";
import { StatusBadge } from "./StatusBadge";
import { InstrumentLogo } from "./InstrumentLogo";

const direction = (value: number | null) => value === null ? "neutral" : value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

type SortKey = "value" | "gain" | "loss" | "ticker";
type ReturnFilter = "all" | "gainers" | "losers";

function compactName(name: string) {
  return name
    .replace(/\s+[—-]\s+Accumulating$/i, "")
    .replace(/\s+UCITS ETF$/i, "")
    .replace(/\s+ETF$/i, "")
    .replace(/\s+EUR P Acc$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function numeric(value: number | null, fallback: number) {
  return value === null || !Number.isFinite(value) ? fallback : value;
}

interface Props {
  positions: PositionMetrics[];
  loading: Set<string>;
  errors: Record<string, string>;
  onSelect: (position: PositionMetrics) => void;
  onDelete: (position: PositionMetrics) => void;
}

export function HoldingsTable({ positions, loading, errors, onSelect, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("value");
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return positions
      .filter((position) => !needle || `${position.instrument.ticker} ${position.instrument.name} ${position.instrument.isin}`.toLowerCase().includes(needle))
      .filter((position) => returnFilter === "all" || (returnFilter === "gainers" ? (position.marketReturn ?? 0) > 0 : (position.marketReturn ?? 0) < 0))
      .sort((left, right) => {
        if (sort === "ticker") return left.instrument.ticker.localeCompare(right.instrument.ticker);
        if (sort === "loss") return numeric(left.marketReturn, Number.POSITIVE_INFINITY) - numeric(right.marketReturn, Number.POSITIVE_INFINITY);
        const leftValue = sort === "gain" ? numeric(left.marketReturn, Number.NEGATIVE_INFINITY) : numeric(left.currentValue, Number.NEGATIVE_INFINITY);
        const rightValue = sort === "gain" ? numeric(right.marketReturn, Number.NEGATIVE_INFINITY) : numeric(right.currentValue, Number.NEGATIVE_INFINITY);
        return rightValue - leftValue;
      });
  }, [positions, query, returnFilter, sort]);

  const count = visible.length === positions.length ? `${positions.length}` : `${visible.length} of ${positions.length}`;

  return <section className="holdings-section" aria-labelledby="holdings-title">
    <div className="section-heading"><div><p className="eyebrow">Positions</p><h2 id="holdings-title">Holdings</h2></div><p>{count} {positions.length === 1 ? "instrument" : "instruments"}</p></div>

    <div className="holdings-toolbar" aria-label="Filter and sort holdings">
      <label className="holdings-search" htmlFor="holdings-search"><span className="sr-only">Search Holdings</span><Search aria-hidden="true" /><input id="holdings-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search holdings" /></label>
      <label className="holdings-sort" htmlFor="holdings-sort"><span>Sort</span><select id="holdings-sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="value">Value</option><option value="gain">Gain</option><option value="loss">Loss</option><option value="ticker">Ticker</option></select></label>
      <div className="return-filter" role="group" aria-label="Filter by return">
        <button type="button" className={returnFilter === "all" ? "active" : ""} aria-pressed={returnFilter === "all"} onClick={() => setReturnFilter("all")}>All</button>
        <button type="button" className={returnFilter === "gainers" ? "active" : ""} aria-pressed={returnFilter === "gainers"} onClick={() => setReturnFilter("gainers")}><TrendingUp aria-hidden="true" /> Gainers</button>
        <button type="button" className={returnFilter === "losers" ? "active" : ""} aria-pressed={returnFilter === "losers"} onClick={() => setReturnFilter("losers")}><TrendingDown aria-hidden="true" /> Losers</button>
      </div>
    </div>

    {!visible.length ? <div className="holdings-empty" role="status">No holdings match these filters.</div> : <>
      <div className="table-shell holdings-desktop">
        <table>
          <thead><tr><th scope="col">Instrument</th><th scope="col">Shares</th><th scope="col">Price</th><th scope="col">Invested</th><th scope="col">Value</th><th scope="col">Market Return</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{visible.map((position) => <tr key={position.instrument.id}>
            <td><button className="instrument-link" onClick={() => onSelect(position)} title={position.instrument.name}><InstrumentLogo instrument={position.instrument} /><span><strong>{position.instrument.ticker}</strong><small>{compactName(position.instrument.name)}</small></span></button></td>
            <td>{formatNumber(position.totalShares)}</td>
            <td><strong>{position.quote ? formatMoney(position.quote.price, position.instrument.currency) : "Unavailable"}</strong><StatusBadge quote={position.quote} loading={loading.has(position.instrument.id)} error={errors[position.instrument.id]} /></td>
            <td>{formatMoney(position.purchaseCostExcludingFees, position.instrument.currency)}</td>
            <td>{formatMoney(position.currentValue, position.instrument.currency)}</td>
            <td><span className={`change ${direction(position.marketReturn)}`}>{position.marketReturn !== null && <span aria-hidden="true">{position.marketReturn >= 0 ? "▲" : "▼"} </span>}{formatMoney(position.marketReturn, position.instrument.currency)}</span><small>{formatPercent(position.marketReturnPercentage)}</small></td>
            <td><div className="row-actions"><button className="icon-button" aria-label={`Open ${position.instrument.ticker} details`} onClick={() => onSelect(position)}><ChevronRight /></button><button className="icon-button danger" aria-label={`Delete ${position.instrument.ticker} holding`} onClick={() => onDelete(position)}><Trash2 /></button></div></td>
          </tr>)}</tbody>
        </table>
      </div>

      <div className="holdings-cards">
        {visible.map((position) => <article className="holding-card" key={position.instrument.id}>
          <header>
            <button className="card-instrument" onClick={() => onSelect(position)} title={position.instrument.name}>
              <InstrumentLogo instrument={position.instrument} />
              <span><strong>{position.instrument.ticker}</strong><small>{compactName(position.instrument.name)}</small></span>
            </button>
            <StatusBadge quote={position.quote} loading={loading.has(position.instrument.id)} error={errors[position.instrument.id]} />
            <details className="holding-menu"><summary aria-label={`More actions for ${position.instrument.ticker}`}><MoreHorizontal aria-hidden="true" /></summary><div><button type="button" onClick={() => onDelete(position)}><Trash2 aria-hidden="true" /> Delete Holding</button></div></details>
          </header>
          <button className="holding-overview" onClick={() => onSelect(position)} aria-label={`Open ${position.instrument.ticker} details`}>
            <strong className="holding-value">{position.currentValue === null ? "Unavailable" : formatMoney(position.currentValue, position.instrument.currency)}</strong>
            <span className={`return-chip ${direction(position.marketReturn)}`}>{position.marketReturn !== null && <span aria-hidden="true">{position.marketReturn >= 0 ? "▲" : "▼"} </span>}{formatMoney(position.marketReturn, position.instrument.currency)} <span>{formatPercent(position.marketReturnPercentage)}</span></span>
            <span className={`holding-today ${direction(position.dailyChange)}`}>Today {formatMoney(position.dailyChange, position.instrument.currency)} <span>{formatPercent(position.dailyChangePercentage)}</span></span>
          </button>
          <footer><span>{formatNumber(position.totalShares)} shares <b>·</b> {position.quote ? `${formatMoney(position.quote.price, position.instrument.currency)} each` : "price unavailable"}</span><button type="button" onClick={() => onSelect(position)}>Details <ChevronRight aria-hidden="true" /></button></footer>
        </article>)}
      </div>
    </>}
  </section>;
}
