import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { VERIFIED_INSTRUMENTS } from "../config/instruments";
import { toLocalIsoDate } from "../format";
import type { Instrument, PurchaseLot } from "../types";
import { InstrumentLogo } from "./InstrumentLogo";
import { useDialogKeyboard } from "./useDialogKeyboard";

export function PurchaseDialog({ onClose, onSave }: { onClose: () => void; onSave: (instrument: Instrument, lot: PurchaseLot) => void }) {
  const [query, setQuery] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [error, setError] = useState("");
  const keyboard = useDialogKeyboard(onClose, "[aria-label='Close purchase form']");
  const options = useMemo(() => VERIFIED_INSTRUMENTS.filter((item) => `${item.ticker} ${item.name} ${item.isin}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const selectedInstrument = useMemo(() => VERIFIED_INSTRUMENTS.find((item) => item.id === instrumentId) ?? null, [instrumentId]);
  const sharesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedInstrument) sharesInputRef.current?.focus();
  }, [selectedInstrument]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const instrument = VERIFIED_INSTRUMENTS.find((item) => item.id === instrumentId);
    const shares = Number(form.get("shares"));
    const pricePerShare = Number(form.get("price"));
    const fees = form.get("fees") === "" ? 0 : Number(form.get("fees"));
    const purchaseDate = String(form.get("date"));
    if (!instrument || !options.some((item) => item.id === instrument.id) || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(pricePerShare) || pricePerShare <= 0 || !Number.isFinite(fees) || fees < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      setError(!instrument
        ? "Select the exact instrument and venue before adding this order."
        : "Enter positive shares and price, a valid date, and fees of zero or more.");
      return;
    }
    onSave(instrument, { id: globalThis.crypto?.randomUUID?.() ?? `lot-${Date.now()}`, instrumentId: instrument.id, shares, pricePerShare, purchaseDate, fees });
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
      <header><div><p className="eyebrow">Record a Transaction</p><h2 id="purchase-title">Add an Order</h2></div><button className="icon-button modal-close" aria-label="Close purchase form" onClick={onClose}><X /></button></header>
      <form onSubmit={submit}>
        {!selectedInstrument ? <div className="instrument-picker">
          <label htmlFor="instrument-search">Find an Instrument</label>
          <div className="input-with-icon"><Search aria-hidden="true" /><input id="instrument-search" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} placeholder="Search by ticker, name or ISIN" spellCheck={false} /></div>
          <fieldset className="instrument-options"><legend>Select Exact Instrument and Venue</legend>{options.map((item) => <label className="instrument-option" key={item.id}><input type="radio" name="instrument" value={item.id} checked={false} onChange={() => { setInstrumentId(item.id); setError(""); }} /><InstrumentLogo instrument={item} /><span><strong>{item.ticker} <em>{item.assetType === "FUND" ? "Fund" : "ETF"}</em></strong><small>{item.name}</small><small>{item.isin} · {item.exchange} · {item.currency}</small></span></label>)}{!options.length && <p className="empty-inline">No verified instrument matches this search.</p>}</fieldset>
        </div> : <div className="selected-instrument" aria-live="polite">
          <InstrumentLogo instrument={selectedInstrument} />
          <span><small>Selected Instrument</small><strong>{selectedInstrument.ticker}</strong><span>{selectedInstrument.name}</span><small>{selectedInstrument.isin} · {selectedInstrument.exchange} · {selectedInstrument.currency}</small></span>
          <button type="button" className="button secondary compact-button" onClick={() => { setInstrumentId(""); setQuery(""); setError(""); }}>Change</button>
        </div>}
        {selectedInstrument && <div className="order-fields"><p className="form-section-label">Order Details</p><div className="form-grid"><label>Shares<input ref={sharesInputRef} name="shares" type="number" min="0.000001" step="any" inputMode="decimal" required /></label><label>Purchase Price per Share<span className="currency-input"><span aria-hidden="true">€</span><input aria-label="Purchase Price per Share" name="price" type="number" min="0.000001" step="any" inputMode="decimal" required /></span></label><label>Purchase Date<input name="date" type="date" max={toLocalIsoDate()} required /></label><label>Broker Fees <span className="optional">Optional</span><span className="currency-input"><span aria-hidden="true">€</span><input name="fees" type="number" min="0" step="0.01" defaultValue="0" inputMode="decimal" /></span></label></div></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button>{selectedInstrument && <button type="submit" className="button primary">Add Purchase</button>}</footer>
      </form>
    </section>
  </div>;
}
