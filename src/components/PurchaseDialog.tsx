import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { VERIFIED_INSTRUMENTS } from "../config/instruments";
import type { Instrument, PurchaseLot } from "../types";
import { useDialogKeyboard } from "./useDialogKeyboard";

export function PurchaseDialog({ onClose, onSave }: { onClose: () => void; onSave: (instrument: Instrument, lot: PurchaseLot) => void }) {
  const [query, setQuery] = useState("");
  const [instrumentId, setInstrumentId] = useState(VERIFIED_INSTRUMENTS[0]?.id ?? "");
  const [error, setError] = useState("");
  const keyboard = useDialogKeyboard(onClose, "#instrument-search");
  const options = useMemo(() => VERIFIED_INSTRUMENTS.filter((item) => `${item.ticker} ${item.name} ${item.isin}`.toLowerCase().includes(query.toLowerCase())), [query]);

  useEffect(() => {
    if (!options.some((item) => item.id === instrumentId)) setInstrumentId(options[0]?.id ?? "");
  }, [instrumentId, options]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const instrument = VERIFIED_INSTRUMENTS.find((item) => item.id === instrumentId);
    const shares = Number(form.get("shares"));
    const pricePerShare = Number(form.get("price"));
    const fees = form.get("fees") === "" ? 0 : Number(form.get("fees"));
    const purchaseDate = String(form.get("date"));
    if (!instrument || !options.some((item) => item.id === instrument.id) || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(pricePerShare) || pricePerShare <= 0 || !Number.isFinite(fees) || fees < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
      setError("Enter positive shares and price, a valid date, and fees of zero or more.");
      return;
    }
    onSave(instrument, { id: globalThis.crypto?.randomUUID?.() ?? `lot-${Date.now()}`, instrumentId: instrument.id, shares, pricePerShare, purchaseDate, fees });
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
      <header><div><p className="eyebrow">Record a transaction</p><h2 id="purchase-title">Add a purchase lot</h2></div><button className="icon-button" aria-label="Close purchase form" onClick={onClose}><X /></button></header>
      <form onSubmit={submit}>
        <label htmlFor="instrument-search">Find an instrument</label>
        <div className="input-with-icon"><Search aria-hidden="true" /><input id="instrument-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by ticker, name or ISIN" autoFocus /></div>
        <fieldset className="instrument-options"><legend>Select exact instrument and venue</legend>{options.map((item) => <label className={`instrument-option ${instrumentId === item.id ? "selected" : ""}`} key={item.id}><input type="radio" name="instrument" value={item.id} checked={instrumentId === item.id} onChange={() => setInstrumentId(item.id)} /><span><strong>{item.ticker} <em>{item.assetType === "FUND" ? "Fund" : "ETF"}</em></strong><small>{item.name}</small><small>{item.isin} · {item.exchange} · {item.currency}</small></span></label>)}{!options.length && <p className="empty-inline">No verified instrument matches this search.</p>}</fieldset>
        <div className="form-grid"><label>Shares / units<input name="shares" type="number" min="0.000001" step="any" inputMode="decimal" required /></label><label>Purchase price per share / unit<input name="price" type="number" min="0.000001" step="any" inputMode="decimal" required /></label><label>Purchase date<input name="date" type="date" max={new Date().toISOString().slice(0, 10)} required /></label><label>Broker fees in EUR <span className="optional">Optional</span><input name="fees" type="number" min="0" step="0.01" defaultValue="0" inputMode="decimal" /><small>Commission only. Do not enter TER or ongoing fund charges.</small></label></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary">Add purchase</button></footer>
      </form>
    </section>
  </div>;
}
