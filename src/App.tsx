import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, RefreshCw, Settings, ShieldCheck, Trash2, Upload } from "lucide-react";
import { DetailDialog } from "./components/DetailDialog";
import { HoldingsTable } from "./components/HoldingsTable";
import { ImportPreviewDialog } from "./components/ImportPreviewDialog";
import { PurchaseDialog } from "./components/PurchaseDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { SummaryCards } from "./components/SummaryCards";
import { SAMPLE_PORTFOLIO } from "./config/samplePortfolio";
import { createPortfolioStorage, exportPortfolioJson, importPortfolioJson } from "./data/storage";
import { calculatePortfolioSummary, calculatePosition } from "./domain/portfolio";
import { fetchEodhdRecord, fetchYahooRecord } from "./market/client";
import { mergeHistory } from "./market/history";
import { isValidMarketRecord, resolveMarketData } from "./market/service";
import type { AppSettings, ChartRange, Instrument, ManualPrice, MarketRecord, PortfolioDocument, PositionMetrics, PurchaseLot } from "./types";

const browserStorage = createPortfolioStorage(window.localStorage);
const cacheKey = (instrumentId: string, range: ChartRange) => `${instrumentId}:${range}`;

function asStaleCache(value: MarketRecord, instrument: Instrument | undefined): MarketRecord | null {
  if (!instrument || !isValidMarketRecord(value, instrument)) return null;
  return { ...value, quote: { ...value.quote, source: "cache", stale: true, label: "Cached price — last successful update" } };
}

export default function App() {
  const [portfolio, setPortfolio] = useState(() => browserStorage.loadPortfolio());
  const [settings, setSettings] = useState(() => browserStorage.loadSettings());
  const [manualPrices, setManualPrices] = useState(() => browserStorage.loadManualPrices());
  const [cache, setCache] = useState(() => browserStorage.loadMarketCache());
  const [records, setRecords] = useState<Record<string, MarketRecord>>(() => {
    const loaded = browserStorage.loadMarketCache();
    return Object.fromEntries(Object.entries(loaded).flatMap(([key, value]) => {
      const instrumentId = key.split(":")[0] ?? key;
      const record = asStaleCache(value, portfolio.instruments.find((instrument) => instrument.id === instrumentId));
      return record ? [[instrumentId, record]] : [];
    }));
  });
  const [loading, setLoading] = useState(new Set<string>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<PortfolioDocument | null>(null);
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const positions = useMemo(() => portfolio.instruments.flatMap((instrument): PositionMetrics[] => {
    const lots = portfolio.lots.filter((lot) => lot.instrumentId === instrument.id);
    if (!lots.length) return [];
    return [calculatePosition(instrument, lots, records[instrument.id]?.quote ?? null)];
  }), [portfolio, records]);
  const summary = useMemo(() => calculatePortfolioSummary(positions, portfolio.baseCurrency), [positions, portfolio.baseCurrency]);
  const selected = positions.find((position) => position.instrument.id === selectedId) ?? null;

  function persist(next: PortfolioDocument) { browserStorage.savePortfolio(next); setPortfolio(next); }

  async function refreshOne(instrument: Instrument, range: ChartRange = "1M") {
    setLoading((current) => new Set(current).add(instrument.id));
    setErrors((current) => ({ ...current, [instrument.id]: "" }));
    const resolution = await resolveMarketData({
      instrument,
      yahoo: () => fetchYahooRecord(instrument, range, settings.proxyUrl),
      cached: cache[cacheKey(instrument.id, range)] ?? cache[cacheKey(instrument.id, "1M")],
      eodhd: settings.eodhdApiKey && instrument.eodhdSymbol ? () => fetchEodhdRecord(instrument, settings.proxyUrl, settings.eodhdApiKey) : undefined,
      manual: manualPrices[instrument.id],
    });
    if (resolution.record) {
      setRecords((current) => ({
        ...current,
        [instrument.id]: {
          ...resolution.record!,
          history: mergeHistory(current[instrument.id]?.history ?? [], resolution.record!.history),
        },
      }));
      if (resolution.record.quote.source === "yahoo") {
        setCache((current) => {
          const next = { ...current, [cacheKey(instrument.id, range)]: resolution.record! };
          browserStorage.saveMarketCache(next);
          return next;
        });
      }
    } else {
      setRecords((current) => { const next = { ...current }; delete next[instrument.id]; return next; });
    }
    if (resolution.errors.length) setErrors((current) => ({ ...current, [instrument.id]: resolution.errors.join(" · ") }));
    setLoading((current) => { const next = new Set(current); next.delete(instrument.id); return next; });
  }

  async function refreshAll() {
    if (!positions.length) return;
    await Promise.all(positions.map((position) => refreshOne(position.instrument)));
    setNotice("Market data refresh finished.");
  }

  useEffect(() => {
    if (settings.proxyUrl && positions.length) void refreshAll();
    // Initial refresh only; subsequent changes have explicit refresh actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLot(instrument: Instrument, lot: PurchaseLot) {
    const exists = portfolio.instruments.some((item) => item.id === instrument.id);
    persist({ ...portfolio, instruments: exists ? portfolio.instruments : [...portfolio.instruments, instrument], lots: [...portfolio.lots, lot] });
    setPurchaseOpen(false); setNotice(`${instrument.ticker} purchase added.`);
  }

  function saveLot(lot: PurchaseLot) { persist({ ...portfolio, lots: portfolio.lots.map((item) => item.id === lot.id ? lot : item) }); }
  function deleteLot(lot: PurchaseLot) {
    if (!window.confirm(`Delete the purchase lot dated ${lot.purchaseDate}? This cannot be undone.`)) return;
    const lots = portfolio.lots.filter((item) => item.id !== lot.id);
    const wasFinalLot = !lots.some((item) => item.instrumentId === lot.instrumentId);
    persist({ ...portfolio, instruments: wasFinalLot ? portfolio.instruments.filter((item) => item.id !== lot.instrumentId) : portfolio.instruments, lots });
    if (wasFinalLot) setSelectedId(null);
  }
  function deleteHolding(position: PositionMetrics) {
    if (!window.confirm(`Delete ${position.instrument.ticker} and all ${position.lots.length} purchase lots? This cannot be undone.`)) return;
    persist({ ...portfolio, instruments: portfolio.instruments.filter((item) => item.id !== position.instrument.id), lots: portfolio.lots.filter((item) => item.instrumentId !== position.instrument.id) });
    setSelectedId(null);
  }
  function saveManual(price: ManualPrice) {
    const next = { ...manualPrices, [price.instrumentId]: price };
    setManualPrices(next); browserStorage.saveManualPrices(next);
    const instrument = portfolio.instruments.find((item) => item.id === price.instrumentId);
    if (instrument) void refreshOne(instrument);
  }

  function exportData() {
    const blob = new Blob([exportPortfolioJson(portfolio)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `eur-portfolio-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  async function readImport(file: File) {
    try { setImportPreview(importPortfolioJson(await file.text())); }
    catch (error) { setNotice(`Import rejected: ${error instanceof Error ? error.message : "invalid JSON"}`); }
    if (importRef.current) importRef.current.value = "";
  }
  function applyImport() { if (!importPreview) return; persist(importPreview); setImportPreview(null); setRecords({}); setNotice("Portfolio imported. Existing portfolio data was replaced."); }
  function clearPortfolio() {
    if (!window.confirm("Clear the entire portfolio, manual prices and cached market data? This cannot be undone.")) return;
    browserStorage.clearPortfolio(); const empty: PortfolioDocument = { schemaVersion: 1, baseCurrency: "EUR", instruments: [], lots: [] }; setPortfolio(empty); setRecords({}); setCache({}); setManualPrices({}); setSelectedId(null);
  }
  function saveSettings(next: AppSettings) { browserStorage.saveSettings(next); setSettings(next); setSettingsOpen(false); setNotice("Market-data settings saved."); }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to portfolio</a>
    <header className="topbar"><a className="brand" href="./" aria-label="Portfolio home"><span>V</span><div><strong>Valeo</strong><small>Personal portfolio</small></div></a><nav aria-label="Portfolio actions"><button className="button ghost" onClick={() => setSettingsOpen(true)}><Settings /> Settings</button><button className="button primary" onClick={() => setPurchaseOpen(true)}><Plus /> Add purchase</button></nav></header>
    {!navigator.onLine && <div className="global-banner" role="status">You are offline. Cached or manual prices may still be available.</div>}
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></div>}
    <main id="main">
      <div className="page-heading"><div><p className="eyebrow">Private · local to this browser</p><h1>Portfolio dashboard</h1><p>Best-effort market data with every source and timestamp shown.</p></div><button className="button secondary" onClick={() => void refreshAll()} disabled={!positions.length || loading.size > 0}><RefreshCw className={loading.size ? "spin" : ""} /> {loading.size ? "Refreshing…" : "Refresh prices"}</button></div>
      <SummaryCards summary={summary} positions={positions} />
      {!positions.length ? <section className="empty-state"><div className="empty-icon"><ShieldCheck /></div><p className="eyebrow">Nothing leaves your device</p><h2>Build your private portfolio</h2><p>Add a purchase or import the private JSON template. Purchase details stay in localStorage and never go to market providers.</p><div><button className="button primary" onClick={() => setPurchaseOpen(true)}><Plus /> Add first purchase</button><button className="button secondary" onClick={() => { persist(SAMPLE_PORTFOLIO); setNotice("Public VanEck sample loaded."); }}>Load public sample</button></div></section> : <HoldingsTable positions={positions} loading={loading} errors={errors} onSelect={(position) => setSelectedId(position.instrument.id)} onDelete={deleteHolding} />}
      <section className="data-tools" aria-labelledby="data-title"><div><p className="eyebrow">Local data</p><h2 id="data-title">Import, export and recovery</h2><p>Exports contain instruments and purchase lots only. Provider keys and cached prices are excluded.</p></div><div className="tool-actions"><input ref={importRef} className="sr-only" id="portfolio-import" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImport(file); }} /><label className="button secondary" htmlFor="portfolio-import"><Upload /> Import JSON</label><button className="button secondary" onClick={exportData}><Download /> Export JSON</button><button className="button danger-button" onClick={clearPortfolio} disabled={!portfolio.instruments.length}><Trash2 /> Clear portfolio</button></div></section>
    </main>
    <footer className="site-footer"><p><ShieldCheck /> Portfolio data remains on this device.</p><p>Prices: latest available — best effort, never guaranteed real-time.</p></footer>
    {purchaseOpen && <PurchaseDialog onClose={() => setPurchaseOpen(false)} onSave={addLot} />}
    {settingsOpen && <SettingsDialog value={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />}
    {selected && <DetailDialog position={selected} record={records[selected.instrument.id] ?? null} loading={loading.has(selected.instrument.id)} error={errors[selected.instrument.id]} onClose={() => setSelectedId(null)} onRange={(range) => void refreshOne(selected.instrument, range)} onLotSave={saveLot} onLotDelete={deleteLot} onManualPrice={saveManual} />}
    {importPreview && <ImportPreviewDialog portfolio={importPreview} onCancel={() => setImportPreview(null)} onApply={applyImport} />}
  </div>;
}
