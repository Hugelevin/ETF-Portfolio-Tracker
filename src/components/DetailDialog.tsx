import { useMemo, useState } from "react";
import { Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { calculatePeriodPerformance } from "../domain/portfolio";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "../format";
import { filterHistoryForRange } from "../market/history";
import type { ChartRange, ManualPrice, MarketRecord, PositionMetrics, PurchaseLot } from "../types";
import { MarketChart } from "./MarketChart";
import { StatusBadge } from "./StatusBadge";
import { useDialogKeyboard } from "./useDialogKeyboard";
import { InstrumentLogo } from "./InstrumentLogo";

const ranges: ChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "MAX"];

interface Props {
  position: PositionMetrics;
  record: MarketRecord | null;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onRange: (range: ChartRange) => void;
  onLotSave: (lot: PurchaseLot) => void;
  onLotDelete: (lot: PurchaseLot) => void;
  onManualPrice: (price: ManualPrice) => void;
  onAnnualYieldSave: (annualYieldPercentage: number) => void;
}

export function DetailDialog({ position, record, loading, error, onClose, onRange, onLotSave, onLotDelete, onManualPrice, onAnnualYieldSave }: Props) {
  const [range, setRange] = useState<ChartRange>("1M");
  const [compare, setCompare] = useState(true);
  const [editing, setEditing] = useState<PurchaseLot | null>(null);
  const keyboard = useDialogKeyboard(onClose, "[aria-label='Close details']");
  const weekly = calculatePeriodPerformance(record?.history ?? [], "1W");
  const monthly = calculatePeriodPerformance(record?.history ?? [], "1M");
  const visibleHistory = useMemo(() => filterHistoryForRange(record?.history ?? [], range), [record, range]);
  const instrument = position.instrument;
  const annualYieldPercentage = instrument.annualYieldPercentage;

  function changeRange(next: ChartRange) { setRange(next); onRange(next); }
  function saveLot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const updated = { ...editing, shares: Number(data.get("shares")), pricePerShare: Number(data.get("price")), purchaseDate: String(data.get("date")), fees: Number(data.get("fees") || 0) };
    if (updated.shares > 0 && updated.pricePerShare > 0 && updated.fees >= 0) { onLotSave(updated); setEditing(null); }
  }
  function setManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const price = Number(data.get("manualPrice"));
    const asOf = String(data.get("manualDate"));
    if (price > 0 && asOf) onManualPrice({ instrumentId: instrument.id, price, asOf });
  }
  function setAnnualYield(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const annualYieldPercentage = Number(new FormData(event.currentTarget).get("annualYield"));
    if (Number.isFinite(annualYieldPercentage) && annualYieldPercentage >= 0) onAnnualYieldSave(annualYieldPercentage);
  }

  return <div className="modal-backdrop detail-backdrop" role="presentation"><section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header className="detail-header"><div className="detail-identity"><InstrumentLogo instrument={instrument} large /><div><p className="eyebrow">{instrument.assetType === "FUND" ? "Accumulating Money-Market Fund" : "Accumulating UCITS ETF"}</p><h2 id="detail-title">{instrument.ticker} · {instrument.name}</h2><p>{instrument.isin} · {instrument.exchange} · {instrument.currency}</p></div></div><button className="icon-button" aria-label="Close details" onClick={onClose}><X /></button></header>
    <div className="detail-body">
      {instrument.assetType === "FUND" ? <div className="quote-strip"><div><p>{position.quote ? "Current NAV" : "Estimated Balance"}</p><strong>{formatMoney(position.currentValue, instrument.currency)}</strong>{position.dailyChange !== null && <small className={position.dailyChange < 0 ? "negative-text" : "positive-text"}>Today {position.dailyChange >= 0 ? "▲" : "▼"} {formatMoney(position.dailyChange, instrument.currency)}</small>}<StatusBadge quote={position.quote} loading={loading} error={error} /></div><div><p>Current APY</p><strong>{annualYieldPercentage === undefined ? "Unavailable" : `${formatNumber(annualYieldPercentage)}%`}</strong></div><div><p>Market Return</p><strong className={position.marketReturn !== null && position.marketReturn < 0 ? "negative-text" : "positive-text"}>{formatMoney(position.marketReturn, instrument.currency)}</strong><small>{formatPercent(position.marketReturnPercentage)}</small></div><div><p>Net Return</p><strong className={position.profitLoss !== null && position.profitLoss < 0 ? "negative-text" : "positive-text"}>{formatMoney(position.profitLoss, instrument.currency)}</strong></div></div> : <div className="quote-strip"><div><p>Current Price</p><strong>{formatMoney(position.quote?.price ?? null, instrument.currency)}</strong>{position.dailyChange !== null && <small className={position.dailyChange < 0 ? "negative-text" : "positive-text"}>Today {position.dailyChange >= 0 ? "▲" : "▼"} {formatMoney(position.dailyChange, instrument.currency)} · {formatPercent(position.dailyChangePercentage)}</small>}<StatusBadge quote={position.quote} loading={loading} error={error} /></div><div><p>Weekly Performance</p><strong className={weekly && weekly.value < 0 ? "negative-text" : "positive-text"}>{weekly ? formatPercent(weekly.percentage) : "Unavailable"}</strong></div><div><p>Monthly Performance</p><strong className={monthly && monthly.value < 0 ? "negative-text" : "positive-text"}>{monthly ? formatPercent(monthly.percentage) : "Unavailable"}</strong></div><div><p>Average Purchase Price</p><strong>{formatMoney(position.averagePurchasePrice, instrument.currency)}</strong></div></div>}
      {position.quote && <p className="provenance">Source: {position.quote.source.toUpperCase()} · Data Timestamp: {formatDateTime(position.quote.asOf)} · Fetched: {formatDateTime(position.quote.fetchedAt)} · Venue: {position.quote.exchange}</p>}
      {instrument.assetType === "FUND" && <p className="fund-note">{position.costBasisWarning ? <><strong>Review Cost Basis:</strong> {position.costBasisWarning}</> : <>Published NAV is used when available so the value and Market Return align with Moneybase. The current APY is saved locally and provides an estimate only when NAV data is unavailable.</>}</p>}
      {instrument.assetType === "ETF" && <><p className="return-note"><strong>Market Return:</strong> {formatMoney(position.marketReturn, instrument.currency)} before fees · <strong>Net Return:</strong> {formatMoney(position.profitLoss, instrument.currency)} after {formatMoney(position.totalFees, instrument.currency)} fees</p><section className="chart-panel" aria-labelledby="chart-title"><div className="chart-toolbar"><div><p className="eyebrow">Performance</p><h3 id="chart-title">Market Value History</h3></div><label className="switch"><input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} /> Compare Invested Cost</label></div><div className="range-controls" aria-label="Chart time range">{ranges.map((item) => <button key={item} className={item === range ? "active" : ""} aria-pressed={item === range} onClick={() => changeRange(item)}>{item}</button>)}</div>{loading ? <div className="chart-empty"><RefreshCw className="spin" aria-hidden="true" /> Loading historical data…</div> : <MarketChart history={visibleHistory} lots={position.lots} compare={compare} currency={instrument.currency} />}</section></>}
      <section className="lots-panel" aria-labelledby="lots-title"><div className="section-heading"><div><p className="eyebrow">Cost Basis</p><h3 id="lots-title">Purchase Lots</h3></div><strong>{formatNumber(position.totalShares)} Total</strong></div><div className="compact-table"><table><thead><tr><th>Date</th><th>Shares</th><th>Purchase Price</th><th>Broker Fees</th><th>Total Cost</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{position.lots.map((lot) => <tr key={lot.id}><td>{lot.purchaseDate}</td><td>{formatNumber(lot.shares)}</td><td>{formatMoney(lot.pricePerShare, instrument.currency)}</td><td>{formatMoney(lot.fees)}</td><td>{formatMoney(lot.shares * lot.pricePerShare + lot.fees, instrument.currency)}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit lot from ${lot.purchaseDate}`} onClick={() => setEditing(lot)}><Pencil /></button><button className="icon-button danger" aria-label={`Delete lot from ${lot.purchaseDate}`} onClick={() => onLotDelete(lot)}><Trash2 /></button></div></td></tr>)}</tbody></table></div></section>
      {instrument.assetType === "FUND" ? <section className="manual-panel"><div><h3>Current Annual Yield</h3><p>Enter the APY shown by Moneybase. It is used only when published NAV data is unavailable.</p></div><form onSubmit={setAnnualYield}><label>APY (%)<input name="annualYield" type="number" min="0" max="100" step="0.01" defaultValue={annualYieldPercentage ?? ""} required /></label><button className="button secondary" type="submit">Save APY</button></form></section> : <section className="manual-panel"><div><h3>Manual Price</h3><p>Use only when provider data is unavailable. It is visibly labelled as a manual value.</p></div><form onSubmit={setManual}><label>Price<input name="manualPrice" type="number" min="0.000001" step="any" required /></label><label>As-of Date<input name="manualDate" type="date" required /></label><button className="button secondary" type="submit">Save Manual Value</button></form></section>}
    </div>
    {editing && <div className="nested-editor" role="dialog" aria-modal="true" aria-labelledby="edit-lot-title"><form onSubmit={saveLot}><div className="section-heading"><h3 id="edit-lot-title">Edit Purchase Lot</h3><button type="button" className="icon-button" aria-label="Close lot editor" onClick={() => setEditing(null)}><X /></button></div><div className="form-grid"><label>Shares<input name="shares" type="number" step="any" min="0.000001" defaultValue={editing.shares} required /></label><label>Purchase Price<input name="price" type="number" step="any" min="0.000001" defaultValue={editing.pricePerShare} required /></label><label>Purchase Date<input name="date" type="date" defaultValue={editing.purchaseDate} required /></label><label>Broker Fees<span className="currency-input"><span aria-hidden="true">€</span><input name="fees" type="number" step="0.01" min="0" defaultValue={editing.fees} required /></span></label></div><footer><button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" type="submit">Save Changes</button></footer></form></div>}
  </section></div>;
}
