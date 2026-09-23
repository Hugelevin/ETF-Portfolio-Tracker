import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChartNoAxesCombined, Plus, RefreshCw, Settings, ShieldCheck, X } from "lucide-react";
import { HoldingsTable } from "./components/HoldingsTable";
import { ImportPreviewDialog } from "./components/ImportPreviewDialog";
import { PurchaseDialog } from "./components/PurchaseDialog";
import { PortfolioInsights } from "./components/PortfolioInsights";
import { SettingsDialog } from "./components/SettingsDialog";
import { SummaryCards } from "./components/SummaryCards";
import { useBodyScrollLock } from "./components/useBodyScrollLock";
import { SAMPLE_PORTFOLIO } from "./config/samplePortfolio";
import { createPortfolioStorage, exportPortfolioJson, importPortfolioJson } from "./data/storage";
import { calculatePortfolioSummary, calculatePosition } from "./domain/portfolio";
import { cacheKey, useMarketData } from "./market/useMarketData";
import type { AppSettings, ChartRange, Instrument, PortfolioDocument, PositionMetrics, PurchaseLot } from "./types";

const browserStorage = createPortfolioStorage(() => window.localStorage);
const loadDetailDialog = () => import("./components/DetailDialog").then((module) => ({ default: module.DetailDialog }));
const DetailDialog = lazy(loadDetailDialog);
const OVERLAY_STATE = "etfPortfolioOverlay";

function downloadJson(json: string, filename: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  // Safari may consume the URL after the click handler returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function App() {
  const [portfolio, setPortfolio] = useState(() => browserStorage.loadPortfolio());
  const [settings, setSettings] = useState(() => browserStorage.loadSettings());
  const activeInstruments = useMemo(() => portfolio.instruments.filter((item) => portfolio.lots.some((lot) => lot.instrumentId === item.id)), [portfolio]);
  const { records, chartRecords, loading, quoteLoading, chartLoading, errors, chartErrors, refreshOne, refreshAll: fetchAll, reset: resetMarket, getRecord } = useMarketData(activeInstruments, settings.proxyUrl, browserStorage);
  const [online, setOnline] = useState(navigator.onLine);
  const [storageWarning, setStorageWarning] = useState(browserStorage.getLoadWarning());
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<PortfolioDocument | null>(null);
  const [notice, setNotice] = useState("");
  const resumeRefresh = useRef<() => void>(() => undefined);

  useEffect(() => {
    // Keep the initial bundle small, then warm the detail screen once the dashboard has settled.
    const timer = window.setTimeout(() => { if (activeInstruments.length) void loadDetailDialog().catch(() => undefined); }, 1_500);
    return () => window.clearTimeout(timer);
  }, [activeInstruments.length]);

  const positions = useMemo(() => portfolio.instruments.flatMap((instrument): PositionMetrics[] => {
    const lots = portfolio.lots.filter((lot) => lot.instrumentId === instrument.id);
    if (!lots.length) return [];
    return [calculatePosition(instrument, lots, records[instrument.id]?.quote ?? null)];
  }), [portfolio, records]);
  const summary = useMemo(() => calculatePortfolioSummary(positions, portfolio.baseCurrency), [positions, portfolio.baseCurrency]);
  const selected = positions.find((position) => position.instrument.id === selectedId) ?? null;
  useBodyScrollLock(purchaseOpen || settingsOpen || selected !== null || importPreview !== null);

  const closePurchase = useCallback(() => {
    setPurchaseOpen(false);
    if (window.history.state?.[OVERLAY_STATE] === "purchase") window.history.back();
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    if (window.history.state?.[OVERLAY_STATE] === "detail") window.history.back();
  }, []);

  function openPurchase() {
    window.history.pushState({ ...(window.history.state ?? {}), [OVERLAY_STATE]: "purchase" }, "", window.location.href);
    setPurchaseOpen(true);
  }

  function openDetail(instrumentId: string) {
    window.history.pushState({ ...(window.history.state ?? {}), [OVERLAY_STATE]: "detail" }, "", window.location.href);
    setSelectedId(instrumentId);
    const instrument = portfolio.instruments.find((item) => item.id === instrumentId);
    // Three daily months reliably cover both a trailing week and calendar month.
    if (instrument && settings.proxyUrl) void refreshOne(instrument, "3M");
  }

  function persist(next: PortfolioDocument): boolean {
    try { setPortfolio(browserStorage.savePortfolio(next)); setStorageWarning(browserStorage.getLoadWarning()); return true; }
    catch { setStorageWarning("Portfolio could not be saved. Export a backup, then free browser storage and try again."); return false; }
  }

  async function refreshAll(range: ChartRange = "1W", announce = true) {
    if (!positions.length) return;
    const updated = await fetchAll(range, true);
    if (announce) setNotice(updated === positions.length ? "Market data refresh finished." : `${updated}/${positions.length} holdings updated. Saved prices are shown where available.`);
  }

  resumeRefresh.current = () => {
    const timestamps = positions
      .map((position) => position.quote ? Date.parse(position.quote.fetchedAt) : 0)
      .filter(Number.isFinite);
    const oldest = timestamps.length ? Math.min(...timestamps) : 0;
    const stale = !oldest || Date.now() - oldest > 15 * 60 * 1_000;
    if (document.visibilityState === "visible" && navigator.onLine && stale && settings.proxyUrl && positions.length && loading.size === 0) {
      void refreshAll("1W", false);
    }
  };

  useEffect(() => {
    const refreshOnResume = () => resumeRefresh.current();
    const onConnectionChange = () => { setOnline(navigator.onLine); if (navigator.onLine) refreshOnResume(); };
    document.addEventListener("visibilitychange", refreshOnResume);
    window.addEventListener("pageshow", refreshOnResume);
    window.addEventListener("online", onConnectionChange);
    window.addEventListener("offline", onConnectionChange);
    return () => {
      document.removeEventListener("visibilitychange", refreshOnResume);
      window.removeEventListener("pageshow", refreshOnResume);
      window.removeEventListener("online", onConnectionChange);
      window.removeEventListener("offline", onConnectionChange);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    // A same-URL history entry lets iOS/Android browser Back close a sheet
    // before the browser leaves the installed site.
    const currentState = window.history.state ?? {};
    if (currentState[OVERLAY_STATE]) {
      const { [OVERLAY_STATE]: _overlay, ...rest } = currentState;
      void _overlay;
      window.history.replaceState(rest, "", window.location.href);
    }
    const onPopState = () => {
      setPurchaseOpen(false);
      setSelectedId(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function addLot(instrument: Instrument, lot: PurchaseLot) {
    const exists = portfolio.instruments.some((item) => item.id === instrument.id);
    if (!persist({ ...portfolio, instruments: exists ? portfolio.instruments : [...portfolio.instruments, instrument], lots: [...portfolio.lots, lot] })) return false;
    closePurchase(); setNotice(`${instrument.ticker} order added.`);
    return true;
  }

  function saveLot(lot: PurchaseLot) { return persist({ ...portfolio, lots: portfolio.lots.map((item) => item.id === lot.id ? lot : item) }); }
  function deleteLot(lot: PurchaseLot) {
    if (!window.confirm(`Delete the order dated ${lot.purchaseDate}? This cannot be undone.`)) return;
    const lots = portfolio.lots.filter((item) => item.id !== lot.id);
    const wasFinalLot = !lots.some((item) => item.instrumentId === lot.instrumentId);
    if (!persist({ ...portfolio, instruments: wasFinalLot ? portfolio.instruments.filter((item) => item.id !== lot.instrumentId) : portfolio.instruments, lots })) return;
    if (wasFinalLot) closeDetail();
  }
  function deleteHolding(position: PositionMetrics) {
    if (!window.confirm(`Delete ${position.instrument.ticker} and all ${position.lots.length} orders? This cannot be undone.`)) return;
    if (!persist({ ...portfolio, instruments: portfolio.instruments.filter((item) => item.id !== position.instrument.id), lots: portfolio.lots.filter((item) => item.instrumentId !== position.instrument.id) })) return;
    closeDetail();
  }
  function exportData() {
    downloadJson(exportPortfolioJson(portfolio), `eur-portfolio-${new Date().toISOString().slice(0, 10)}.json`);
  }
  async function readImport(file: File) {
    try { setImportPreview(importPortfolioJson(await file.text())); setSettingsOpen(false); }
    catch (error) { setNotice(`Import rejected: ${error instanceof Error ? error.message : "invalid JSON"}`); }
  }
  function applyImport() { if (!importPreview || !persist(importPreview)) return; setImportPreview(null); resetMarket(); setNotice("Portfolio imported. Existing portfolio data was replaced."); }
  function clearPortfolio() {
    if (!window.confirm("Clear the entire portfolio and cached market data? This cannot be undone.")) return false;
    try { browserStorage.clearPortfolio(); } catch { setStorageWarning("Browser storage could not be cleared. Try again."); return false; }
    const empty: PortfolioDocument = { schemaVersion: 1, baseCurrency: "EUR", instruments: [], lots: [] }; setPortfolio(empty); resetMarket(); setSelectedId(null); setStorageWarning("");
    setNotice("Portfolio cleared.");
    return true;
  }
  function saveSettings(next: AppSettings) { try { browserStorage.saveSettings(next); setSettings(next); setSettingsOpen(false); setNotice("Market-data settings saved."); } catch { setStorageWarning("Settings could not be saved. Check browser storage and try again."); } }
  const refreshInsights = useCallback((range: ChartRange) => { void fetchAll(range, false); }, [fetchAll]);

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to portfolio</a>
    <header className="topbar"><a className="brand" href="./" aria-label="ETF Portfolio Tracker home"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ETF Portfolio Tracker" /></a><nav aria-label="Portfolio actions"><button className="button ghost" onClick={() => setSettingsOpen(true)}><Settings /> <span>Settings</span></button><button className="button primary add-purchase" aria-label="Add Order" onClick={openPurchase}><Plus /> <span className="desktop-label">Add Order</span><span className="mobile-label">Add</span></button></nav></header>
    {!online && <div className="global-banner" role="status">You are offline. The last saved market update may still be available.</div>}
    {storageWarning && <div className="global-banner" role="alert">{storageWarning}{browserStorage.getRecoveryJson() !== null && <button className="button secondary" onClick={() => downloadJson(browserStorage.getRecoveryJson()!, "portfolio-recovery.json")}>Export Recovery Data</button>}</div>}
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X aria-hidden="true" /></button></div>}
    <main id="main">
      <div className="page-heading"><h1>Portfolio Dashboard</h1><button className="button secondary refresh-button" aria-label={loading.size ? "Refreshing Prices" : "Refresh Prices"} onClick={() => void refreshAll()} disabled={!positions.length || loading.size > 0}><RefreshCw className={loading.size ? "spin" : ""} /> <span>{loading.size ? "Refreshing…" : "Refresh Prices"}</span></button></div>
      <SummaryCards summary={summary} positions={positions} updatedAt={positions.map((position) => position.quote?.fetchedAt).filter((value): value is string => Boolean(value)).sort()[0] ?? null} />
      {!positions.length ? <section className="empty-state"><div className="empty-icon"><ChartNoAxesCombined /></div><p className="eyebrow">Get Started</p><h2>Build Your Portfolio</h2><p>Add an order or import your portfolio JSON file to begin tracking your investments.</p><div><button className="button primary" onClick={openPurchase}><Plus /> Add First Order</button><button className="button secondary" onClick={() => { if (persist(SAMPLE_PORTFOLIO)) setNotice("Public VanEck sample loaded."); }}>Load Public Sample</button></div></section> : <HoldingsTable positions={positions} loading={quoteLoading} errors={errors} sparklineHistory={(instrumentId) => chartRecords[cacheKey(instrumentId, "1W")]?.history ?? chartRecords[cacheKey(instrumentId, "1M")]?.history ?? []} onSelect={(position) => openDetail(position.instrument.id)} />}
      {positions.length > 0 && <PortfolioInsights positions={positions} baseCurrency={portfolio.baseCurrency} loading={activeInstruments.some((instrument) => chartLoading.has(cacheKey(instrument.id, "MAX")))} getRecord={getRecord} getError={(id, range) => chartErrors[cacheKey(id, range)]} onRange={refreshInsights} />}
    </main>
    <footer className="site-footer"><p><ShieldCheck aria-hidden="true" /> Portfolio data remains on this device.</p><p><ChartNoAxesCombined aria-hidden="true" /> Market data provided by Yahoo Finance.</p></footer>
    {purchaseOpen && <PurchaseDialog onClose={closePurchase} onSave={addLot} />}
    {settingsOpen && <SettingsDialog value={settings} hasPortfolio={portfolio.instruments.length > 0} onClose={() => setSettingsOpen(false)} onSave={saveSettings} onImport={(file) => void readImport(file)} onExport={exportData} onClear={() => { if (clearPortfolio()) setSettingsOpen(false); }} />}
    {selected && <Suspense fallback={<div className="modal-backdrop detail-backdrop"><section className="modal detail-modal detail-loading" role="status"><RefreshCw className="spin" /> Loading Holding Details…</section></div>}><DetailDialog position={selected} getRecord={(range) => chartRecords[cacheKey(selected.instrument.id, range)] ?? null} getChartError={(range) => chartErrors[cacheKey(selected.instrument.id, range)]} loading={quoteLoading.has(selected.instrument.id)} isRangeLoading={(range) => chartLoading.has(cacheKey(selected.instrument.id, range))} error={errors[selected.instrument.id]} onClose={closeDetail} onRange={(range) => void refreshOne(selected.instrument, range)} onLotSave={saveLot} onLotDelete={deleteLot} onHoldingDelete={() => deleteHolding(selected)} /></Suspense>}
    {importPreview && <ImportPreviewDialog portfolio={importPreview} onCancel={() => setImportPreview(null)} onApply={applyImport} />}
  </div>;
}
