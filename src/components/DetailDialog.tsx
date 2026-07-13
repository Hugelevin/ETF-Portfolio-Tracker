import { useMemo, useState } from "react";
import { ChartNoAxesCombined, Pencil, RefreshCw, Trash2, WalletCards, X } from "lucide-react";
import { calculateAnnualisedYield, calculatePeriodPerformance } from "../domain/portfolio";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "../format";
import { filterHistoryForRange } from "../market/history";
import type { ChartRange, MarketRecord, PositionMetrics, PurchaseLot } from "../types";
import { InstrumentLogo } from "./InstrumentLogo";
import { MarketChart, type ChartMode } from "./MarketChart";
import { StatusBadge } from "./StatusBadge";
import { useDialogKeyboard } from "./useDialogKeyboard";

const ranges: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

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
  const [range, setRange] = useState<ChartRange>("1M");
  const [chartMode, setChartMode] = useState<ChartMode>("price");
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
  const weekly = calculatePeriodPerformance(metricsHistory, "1W");
  const monthly = calculatePeriodPerformance(metricsHistory, "1M");
  const annualisedYield = calculateAnnualisedYield(metricsHistory, 7);
  const visibleHistory = useMemo(() => filterHistoryForRange(history, range), [history, range]);
  const instrument = position.instrument;

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
        <button className="icon-button" aria-label="Close details" onClick={onClose}><X /></button>
      </header>

      <div className="detail-body">
        {instrument.assetType === "FUND" ? <div className="quote-strip">
          <div><p>Current NAV</p><strong>{formatMoney(position.quote?.price ?? null, instrument.currency)}</strong>{position.quote?.previousClose != null && <small className={position.quote.price < position.quote.previousClose ? "negative-text" : "positive-text"}>Today {position.quote.price >= position.quote.previousClose ? "▲" : "▼"} {formatMoney(position.quote.price - position.quote.previousClose, instrument.currency)} · {formatPercent(((position.quote.price - position.quote.previousClose) / position.quote.previousClose) * 100)}</small>}<StatusBadge quote={position.quote} loading={loading} error={error} /></div>
          <div><p>{annualisedYield ? `${formatNumber(annualisedYield.days)}-Day Annualised NAV Yield` : "7-Day Annualised NAV Yield"}</p><strong>{annualisedYield ? formatPercent(annualisedYield.percentage) : "Unavailable"}</strong><small>{annualisedYield ? "Calculated automatically from published NAV" : "Needs recent NAV data spanning at least 7 days"}</small></div>
          <div><p>Market Return</p><strong className={position.marketReturn !== null && position.marketReturn < 0 ? "negative-text" : "positive-text"}>{formatMoney(position.marketReturn, instrument.currency)}</strong><small>{formatPercent(position.marketReturnPercentage)}</small></div>
          <div><p>Net Return</p><strong className={position.profitLoss !== null && position.profitLoss < 0 ? "negative-text" : "positive-text"}>{formatMoney(position.profitLoss, instrument.currency)}</strong><small>After {formatMoney(position.totalFees, instrument.currency)} Broker Fees</small></div>
        </div> : <div className="quote-strip">
          <div><p>Current Price</p><strong>{formatMoney(position.quote?.price ?? null, instrument.currency)}</strong>{position.dailyChange !== null && <small className={position.dailyChange < 0 ? "negative-text" : "positive-text"}>Today {position.dailyChange >= 0 ? "▲" : "▼"} {formatMoney(position.dailyChange, instrument.currency)} · {formatPercent(position.dailyChangePercentage)}</small>}<StatusBadge quote={position.quote} loading={loading} error={error} /></div>
          <div><p>Weekly Performance</p><strong className={weekly && weekly.value < 0 ? "negative-text" : "positive-text"}>{weekly ? formatPercent(weekly.percentage) : "Unavailable"}</strong></div>
          <div><p>Monthly Performance</p><strong className={monthly && monthly.value < 0 ? "negative-text" : "positive-text"}>{monthly ? formatPercent(monthly.percentage) : "Unavailable"}</strong></div>
          <div><p>Average Purchase Price</p><strong>{formatMoney(position.averagePurchasePrice, instrument.currency)}</strong></div>
        </div>}

        {position.quote && <p className="provenance">Source: {position.quote.source.toUpperCase()} · Data Timestamp: {formatDateTime(position.quote.asOf)} · Fetched: {formatDateTime(position.quote.fetchedAt)} · Venue: {position.quote.exchange}</p>}
        {instrument.assetType === "FUND" && <p className="fund-note">{position.costBasisWarning ? <><strong>Review Cost Basis:</strong> {position.costBasisWarning}</> : <>Published NAV determines the fund value and return. The displayed annualised yield is recalculated automatically from NAV history whenever market data refreshes; it is not Moneybase's advertised APY.</>}</p>}
        {instrument.assetType === "ETF" && <p className="return-note"><strong>Market Return:</strong> {formatMoney(position.marketReturn, instrument.currency)} before fees · <strong>Net Return:</strong> {formatMoney(position.profitLoss, instrument.currency)} after {formatMoney(position.totalFees, instrument.currency)} fees</p>}

        <section className="chart-panel" aria-labelledby="chart-title">
          <div className="chart-toolbar">
            <div><p className="eyebrow">Performance</p><h3 id="chart-title">{chartMode === "price" ? (instrument.assetType === "FUND" ? "NAV History" : "Market Price History") : "Position Value vs Invested Amount"}</h3></div>
            <div className="view-controls" role="group" aria-label="Chart view">
              <button type="button" className={chartMode === "price" ? "active" : ""} aria-pressed={chartMode === "price"} onClick={() => setChartMode("price")}><ChartNoAxesCombined aria-hidden="true" /> {instrument.assetType === "FUND" ? "NAV" : "Price"}</button>
              <button type="button" className={chartMode === "value" ? "active" : ""} aria-pressed={chartMode === "value"} onClick={() => setChartMode("value")}><WalletCards aria-hidden="true" /> Value vs Invested</button>
            </div>
          </div>
          <div className="range-controls" aria-label="Chart time range">{ranges.map((item) => <button key={item} className={item === range ? "active" : ""} aria-pressed={item === range} onClick={() => changeRange(item)}>{item}</button>)}</div>
          {instrument.assetType === "FUND" && range === "1D" && <p className="chart-hint">This fund publishes one NAV per trading day, so intraday prices are not available.</p>}
          {loading ? <div className="chart-empty"><RefreshCw className="spin" aria-hidden="true" /> Loading Historical Data…</div> : <MarketChart history={visibleHistory} lots={position.lots} mode={chartMode} currency={instrument.currency} />}
        </section>

        <section className="lots-panel" aria-labelledby="lots-title">
          <div className="section-heading"><div><p className="eyebrow">Cost Basis</p><h3 id="lots-title">Orders</h3></div><strong>{formatNumber(position.totalShares)} Total</strong></div>
          <div className="compact-table"><table><thead><tr><th>Date</th><th>Shares</th><th>Purchase Price</th><th>Broker Fees</th><th>Total Cost</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{position.lots.map((lot) => <tr key={lot.id}><td>{lot.purchaseDate}</td><td>{formatNumber(lot.shares)}</td><td>{formatMoney(lot.pricePerShare, instrument.currency)}</td><td>{formatMoney(lot.fees)}</td><td>{formatMoney(lot.shares * lot.pricePerShare + lot.fees, instrument.currency)}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit order from ${lot.purchaseDate}`} onClick={() => setEditing(lot)}><Pencil /></button><button className="icon-button danger" aria-label={`Delete order from ${lot.purchaseDate}`} onClick={() => onLotDelete(lot)}><Trash2 /></button></div></td></tr>)}</tbody></table></div>
        </section>

      </div>

      {editing && <LotEditor lot={editing} onClose={() => setEditing(null)} onSave={(lot) => { onLotSave(lot); setEditing(null); }} />}
    </section>
  </div>;
}

function LotEditor({ lot, onClose, onSave }: { lot: PurchaseLot; onClose: () => void; onSave: (lot: PurchaseLot) => void }) {
  const keyboard = useDialogKeyboard(onClose, "input[name='shares']");

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
      <div className="section-heading"><h3 id="edit-lot-title">Edit Order</h3><button type="button" className="icon-button" aria-label="Close order editor" onClick={onClose}><X /></button></div>
      <div className="form-grid"><label>Shares<input name="shares" type="number" step="any" min="0.000001" defaultValue={lot.shares} required /></label><label>Purchase Price<input name="price" type="number" step="any" min="0.000001" defaultValue={lot.pricePerShare} required /></label><label>Purchase Date<input name="date" type="date" defaultValue={lot.purchaseDate} required /></label><label>Broker Fees<span className="currency-input"><span aria-hidden="true">€</span><input name="fees" type="number" step="0.01" min="0" defaultValue={lot.fees} required /></span></label></div>
      <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save Changes</button></footer>
    </form>
  </div>;
}
