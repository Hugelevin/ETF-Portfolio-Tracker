import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChartNoAxesCombined, MoreHorizontal, Pencil, RefreshCw, Trash2, WalletCards, X } from "lucide-react";
import { calculateAnnualisedYield, calculateHistoryPerformance } from "../domain/portfolio";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent, formatPercentInBrackets, formatSignedMoney } from "../format";
import { filterHistoryForRange } from "../market/history";
import type { ChartRange, MarketRecord, PositionMetrics, PurchaseLot } from "../types";
import { InstrumentLogo } from "./InstrumentLogo";
import type { ChartMode } from "./MarketChart";
import { StatusBadge } from "./StatusBadge";
import { useDialogKeyboard } from "./useDialogKeyboard";
import { useMediaQuery } from "./useMediaQuery";

const ranges: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];
const MarketChart = lazy(() => import("./MarketChart").then((module) => ({ default: module.MarketChart })));

interface Props {
  position: PositionMetrics;
  getRecord: (range: ChartRange) => MarketRecord | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onRange: (range: ChartRange) => void;
  onLotSave: (lot: PurchaseLot) => void;
  onLotDelete: (lot: PurchaseLot) => void;
}

export function DetailDialog({ position, getRecord, loading, error, onClose, onRange, onLotSave, onLotDelete }: Props) {
  const [range, setRange] = useState<ChartRange>("1W");
  const [chartMode, setChartMode] = useState<ChartMode>("price");
  const [chartReady, setChartReady] = useState(false);
  const [editing, setEditing] = useState<PurchaseLot | null>(null);
  const keyboard = useDialogKeyboard(onClose, "[aria-label='Close details']");
  const record = getRecord(range);
  const history = useMemo(() => record?.history ?? [], [record]);
  // Prefer daily history long enough for calendar-month performance. This is
  // independent of the selected chart range so headline metrics stay stable.
  const metricsRecord = (["3M", "1Y", "MAX", "1M"] as ChartRange[])
    .map((candidateRange) => getRecord(candidateRange))
    .filter((candidate): candidate is MarketRecord => Boolean(candidate?.history.length))
    .sort((a, b) => Date.parse(b.quote.asOf) - Date.parse(a.quote.asOf))[0];
  const metricsHistory = metricsRecord?.history ?? history;
  const annualisedYield = calculateAnnualisedYield(metricsHistory, 7);
  const visibleHistory = useMemo(() => filterHistoryForRange(history, range), [history, range]);
  const selectedPerformance = calculateHistoryPerformance(visibleHistory, range);
  const instrument = position.instrument;
  const mobileOrders = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    const timeout = window.setTimeout(() => setChartReady(true), 150);
    return () => window.clearTimeout(timeout);
  }, []);

  function changeRange(next: ChartRange) {
    setRange(next);
    onRange(next);
  }

  return <div className="modal-backdrop detail-backdrop" role="presentation">
    <section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
      <header className="detail-header">
        <div className="detail-identity">
          <InstrumentLogo instrument={instrument} large />
          <div>
            <p className="eyebrow">{instrument.assetType === "FUND" ? "Accumulating Money-Market Fund" : "Accumulating UCITS ETF"}</p>
            <h2 id="detail-title">{instrument.ticker} · {instrument.name}</h2>
            <p>{instrument.isin} · {instrument.exchange} · {instrument.currency}</p>
          </div>
        </div>
        <button className="icon-button modal-close" aria-label="Close details" onClick={onClose}><X /></button>
      </header>

      <div className="detail-body">
        {instrument.assetType === "FUND" ? <div className="quote-strip">
          <div><p>Current NAV</p><strong>{formatMoney(position.quote?.price ?? null, instrument.currency)}</strong>{position.quote?.previousClose != null && <small className={position.quote.price < position.quote.previousClose ? "negative-text" : "positive-text"}>Today {position.quote.price >= position.quote.previousClose ? "▲" : "▼"} {formatMoney(position.quote.price - position.quote.previousClose, instrument.currency)} {formatPercentInBrackets(((position.quote.price - position.quote.previousClose) / position.quote.previousClose) * 100)}</small>}<StatusBadge quote={position.quote} loading={loading} error={error} /></div>
          <div><p>{annualisedYield ? `${formatNumber(annualisedYield.days)}-Day Annualised NAV Yield` : "7-Day Annualised NAV Yield"}</p><strong>{annualisedYield ? formatPercent(annualisedYield.percentage) : "Unavailable"}</strong><small>{annualisedYield ? "Calculated automatically from published NAV" : "Needs recent NAV data spanning at least 7 days"}</small></div>
          <div><p>Market Return</p><strong className={position.marketReturn !== null && position.marketReturn < 0 ? "negative-text" : "positive-text"}>{formatMoney(position.marketReturn, instrument.currency)}</strong><small>{formatPercentInBrackets(position.marketReturnPercentage)}</small></div>
          <div><p>Net Return</p><strong className={position.profitLoss !== null && position.profitLoss < 0 ? "negative-text" : "positive-text"}>{formatMoney(position.profitLoss, instrument.currency)}</strong><small>After {formatMoney(position.totalFees, instrument.currency)} Broker Fees</small></div>
        </div> : <div className="quote-strip">
          <div><p>Current Price</p><strong>{formatMoney(position.quote?.price ?? null, instrument.currency)}</strong>{position.dailyChange !== null && <small className={position.dailyChange < 0 ? "negative-text" : "positive-text"}>Today {position.dailyChange >= 0 ? "▲" : "▼"} {formatMoney(position.dailyChange, instrument.currency)} {formatPercentInBrackets(position.dailyChangePercentage)}</small>}<StatusBadge quote={position.quote} loading={loading} error={error} /></div>
          <div className="selected-performance"><p>{range} Performance</p><strong aria-live="polite" className={selectedPerformance ? (selectedPerformance.value < 0 ? "negative-text" : "positive-text") : undefined}>{loading ? "Loading..." : selectedPerformance ? formatPercent(selectedPerformance.percentage) : "Not Enough Data"}</strong><small>{loading ? "Fetching selected range" : selectedPerformance ? `${formatSignedMoney(selectedPerformance.value, instrument.currency)} price change` : `Current value ${formatMoney(position.currentValue, instrument.currency)}`}</small></div>
          <div><p>Average Purchase Price</p><strong>{formatMoney(position.averagePurchasePrice, instrument.currency)}</strong></div>
          <div><p>Market Return</p><strong className={position.marketReturn !== null ? (position.marketReturn < 0 ? "negative-text" : "positive-text") : undefined}>{formatMoney(position.marketReturn, instrument.currency)}</strong><small>{formatPercentInBrackets(position.marketReturnPercentage)}</small></div>
        </div>}

        {position.quote && <p className="market-data-line" aria-label="Market data details"><span>Source: {position.quote.source.toUpperCase()}</span><span aria-hidden="true"> · </span><span>Data: {formatDateTime(position.quote.asOf)}</span><span aria-hidden="true"> · </span><span>Fetched: {formatDateTime(position.quote.fetchedAt)}</span></p>}
        {instrument.assetType === "FUND" && position.costBasisWarning && <p className="fund-note"><strong>Review Cost Basis:</strong> {position.costBasisWarning}</p>}

        <section className="chart-panel" aria-labelledby="chart-title">
          <div className="chart-toolbar">
            <div><p className="eyebrow">Performance</p><h3 id="chart-title">{chartMode === "price" ? (instrument.assetType === "FUND" ? "NAV History" : "Market Price History") : "Holding Value vs Invested Cost"}</h3></div>
            <div className="view-controls" role="group" aria-label="Chart view">
              <button type="button" className={chartMode === "price" ? "active" : ""} aria-pressed={chartMode === "price"} onClick={() => setChartMode("price")}><ChartNoAxesCombined aria-hidden="true" /> {instrument.assetType === "FUND" ? "NAV" : "Price"}</button>
              <button type="button" className={chartMode === "value" ? "active" : ""} aria-pressed={chartMode === "value"} onClick={() => setChartMode("value")}><WalletCards aria-hidden="true" /> Holding Value</button>
            </div>
          </div>
          <div className="range-controls" aria-label="Chart time range">{ranges.map((item) => <button key={item} className={item === range ? "active" : ""} aria-pressed={item === range} onClick={() => changeRange(item)}>{item}</button>)}</div>
          {instrument.assetType === "FUND" && range === "1D" && <p className="chart-hint">This fund publishes one NAV per trading day, so intraday prices are not available.</p>}
          {loading ? <div className="chart-empty"><RefreshCw className="spin" aria-hidden="true" /> Loading Historical Data…</div>
            : !visibleHistory.length ? <div className="chart-empty">{chartMode === "value" ? "No holding value exists in this range because it is before your first purchase." : "Historical market prices are unavailable for this range."}</div>
              : !chartReady ? <div className="chart-empty chart-skeleton" role="status">Preparing Chart…</div>
                : <Suspense fallback={<div className="chart-empty chart-skeleton" role="status">Preparing Chart…</div>}><MarketChart history={visibleHistory} lots={position.lots} mode={chartMode} currency={instrument.currency} averagePurchasePrice={position.averagePurchasePrice} /></Suspense>}
        </section>

        <section className="lots-panel" aria-labelledby="lots-title">
          <div className="section-heading"><div><p className="eyebrow">Cost Basis</p><h3 id="lots-title">Orders</h3></div><strong className="order-count">{position.lots.length} {position.lots.length === 1 ? "Order" : "Orders"}</strong></div>
          {!mobileOrders ? <div className="compact-table orders-table"><table><thead><tr><th>Date</th><th>Shares</th><th>Purchase Price</th><th>Broker Fees</th><th>Total Cost</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{position.lots.map((lot) => <tr key={lot.id}><td>{formatDate(lot.purchaseDate)}</td><td>{formatNumber(lot.shares)}</td><td>{formatMoney(lot.pricePerShare, instrument.currency)}</td><td>{formatMoney(lot.fees)}</td><td>{formatMoney(lot.shares * lot.pricePerShare + lot.fees, instrument.currency)}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit order from ${lot.purchaseDate}`} onClick={() => setEditing(lot)}><Pencil /></button><button className="icon-button danger" aria-label={`Delete order from ${lot.purchaseDate}`} onClick={() => onLotDelete(lot)}><Trash2 /></button></div></td></tr>)}</tbody></table></div>
          : <div className="order-cards">{position.lots.map((lot) => <article className="order-card" key={lot.id}>
            <header><time dateTime={lot.purchaseDate}><CalendarDays aria-hidden="true" /> {formatDate(lot.purchaseDate)}</time><details className="order-menu"><summary aria-label={`Order actions for ${lot.purchaseDate}`}><MoreHorizontal aria-hidden="true" /></summary><div><button type="button" onClick={() => setEditing(lot)}><Pencil aria-hidden="true" /> Edit</button><button type="button" className="danger" onClick={() => onLotDelete(lot)}><Trash2 aria-hidden="true" /> Delete</button></div></details></header>
            <dl><div><dt>Shares</dt><dd>{formatNumber(lot.shares)}</dd></div><div><dt>Each</dt><dd>{formatMoney(lot.pricePerShare, instrument.currency)}</dd></div><div><dt>Fees</dt><dd>{formatMoney(lot.fees)}</dd></div><div className="order-total"><dt>Total</dt><dd>{formatMoney(lot.shares * lot.pricePerShare + lot.fees, instrument.currency)}</dd></div></dl>
          </article>)}</div>}
        </section>
      </div>

      {editing && <LotEditor lot={editing} onClose={() => setEditing(null)} onSave={(lot) => { onLotSave(lot); setEditing(null); }} />}
    </section>
  </div>;
}

function LotEditor({ lot, onClose, onSave }: { lot: PurchaseLot; onClose: () => void; onSave: (lot: PurchaseLot) => void }) {
  const keyboard = useDialogKeyboard(onClose, "[aria-label='Close order editor']");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const updated = {
      ...lot,
      shares: Number(data.get("shares")),
      pricePerShare: Number(data.get("price")),
      purchaseDate: String(data.get("date")),
      fees: Number(data.get("fees") || 0),
    };
    if (updated.shares > 0 && updated.pricePerShare > 0 && updated.fees >= 0) onSave(updated);
  }

  return <div className="nested-editor" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form ref={keyboard.dialogRef as React.RefObject<HTMLFormElement | null>} role="dialog" aria-modal="true" aria-labelledby="edit-lot-title" onSubmit={submit} onKeyDown={(event) => { keyboard.onKeyDown(event); event.stopPropagation(); }}>
      <div className="section-heading"><h3 id="edit-lot-title">Edit Order</h3><button type="button" className="icon-button modal-close" aria-label="Close order editor" onClick={onClose}><X /></button></div>
      <div className="form-grid"><label>Shares<input name="shares" type="number" step="any" min="0.000001" defaultValue={lot.shares} required /></label><label>Purchase Price<span className="currency-input"><span aria-hidden="true">€</span><input aria-label="Purchase Price" name="price" type="number" step="any" min="0.000001" defaultValue={lot.pricePerShare} required /></span></label><label>Purchase Date<input name="date" type="date" defaultValue={lot.purchaseDate} required /></label><label>Broker Fees<span className="currency-input"><span aria-hidden="true">€</span><input name="fees" type="number" step="0.01" min="0" defaultValue={lot.fees} required /></span></label></div>
      <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save Changes</button></footer>
    </form>
  </div>;
}
