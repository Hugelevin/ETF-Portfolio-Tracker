import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChartNoAxesCombined, Download, Plus, RefreshCw, Settings, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { DetailDialog } from "./components/DetailDialog";
import { HoldingsTable } from "./components/HoldingsTable";
import { ImportPreviewDialog } from "./components/ImportPreviewDialog";
import { PurchaseDialog } from "./components/PurchaseDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { SummaryCards } from "./components/SummaryCards";
import { SAMPLE_PORTFOLIO } from "./config/samplePortfolio";
import { createPortfolioStorage, exportPortfolioJson, importPortfolioJson } from "./data/storage";
import { calculatePortfolioSummary, calculatePosition } from "./domain/portfolio";
import { fetchYahooRecord } from "./market/client";
import { isValidMarketRecord, resolveMarketData } from "./market/service";
import type { AppSettings, ChartRange, Instrument, MarketRecord, PortfolioDocument, PositionMetrics, PurchaseLot } from "./types";

const browserStorage = createPortfolioStorage(window.localStorage);
const cacheKey = (instrumentId: string, range: ChartRange) => `${instrumentId}:${range}`;
const OVERLAY_STATE = "etfPortfolioOverlay";

function asStaleCache(value: MarketRecord | undefined, instrument: Instrument | undefined): MarketRecord | null {
  if (!value || !instrument || !isValidMarketRecord(value, instrument)) return null;
  return { ...value, quote: { ...value.quote, source: "cache", stale: true, label: "Cached price - last successful update" } };
}

function freshestRecord(existing: MarketRecord | undefined, incoming: MarketRecord): MarketRecord {
  if (!existing) return incoming;
  const asOfDifference = Date.parse(incoming.quote.asOf) - Date.parse(existing.quote.asOf);
  if (asOfDifference !== 0) return asOfDifference > 0 ? incoming : existing;
  const priority = { yahoo: 2, cache: 1 } as const;
  const sourceDifference = priority[incoming.quote.source] - priority[existing.quote.source];
  if (sourceDifference !== 0) return sourceDifference > 0 ? incoming : existing;
  return Date.parse(incoming.quote.fetchedAt) > Date.parse(existing.quote.fetchedAt) ? incoming : existing;
}

export default function App() {
  const [portfolio, setPortfolio] = useState(() => browserStorage.loadPortfolio());
  const [settings, setSettings] = useState(() => browserStorage.loadSettings());
  const [cache, setCache] = useState(() => browserStorage.loadMarketCache());
  const [records, setRecords] = useState<Record<string, MarketRecord>>(() => {
    const loaded = browserStorage.loadMarketCache();
    return Object.fromEntries(portfolio.instruments.flatMap((instrument) => {
      const record = Object.entries(loaded)
        .filter(([key]) => key.startsWith(`${instrument.id}:`))
        .map(([, value]) => asStaleCache(value, instrument))
        .filter((value): value is MarketRecord => value !== null)
        .reduce<MarketRecord | undefined>((latest, candidate) => freshestRecord(latest, candidate), undefined);
      return record ? [[instrument.id, record]] : [];
    }));
  });
  const [chartRecords, setChartRecords] = useState<Record<string, MarketRecord>>(() => {
    const loaded = browserStorage.loadMarketCache();
    return Object.fromEntries(Object.entries(loaded).flatMap(([key, value]) => {
      const instrumentId = key.split(":")[0] ?? key;
      const record = asStaleCache(value, portfolio.instruments.find((instrument) => instrument.id === instrumentId));
      return record ? [[key, record]] : [];
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
  const latestRequest = useRef<Record<string, number>>({});
  const latestRangeRequest = useRef<Record<string, number>>({});

  const positions = useMemo(() => portfolio.instruments.flatMap((instrument): PositionMetrics[] => {
    const lots = portfolio.lots.filter((lot) => lot.instrumentId === instrument.id);
    if (!lots.length) return [];
    return [calculatePosition(instrument, lots, records[instrument.id]?.quote ?? null)];
  }), [portfolio, records]);
  const summary = useMemo(() => calculatePortfolioSummary(positions, portfolio.baseCurrency), [positions, portfolio.baseCurrency]);
  const selected = positions.find((position) => position.instrument.id === selectedId) ?? null;

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
  }

  function persist(next: PortfolioDocument) { setPortfolio(browserStorage.savePortfolio(next)); }

  async function refreshOne(instrument: Instrument, range: ChartRange = "1M") {
    const requestId = (latestRequest.current[instrument.id] ?? 0) + 1;
    latestRequest.current[instrument.id] = requestId;
    const selectedCacheKey = cacheKey(instrument.id, range);
    const rangeRequestId = (latestRangeRequest.current[selectedCacheKey] ?? 0) + 1;
    latestRangeRequest.current[selectedCacheKey] = rangeRequestId;
    setLoading((current) => new Set(current).add(instrument.id));
    setErrors((current) => ({ ...current, [instrument.id]: "" }));
    const resolution = await resolveMarketData({
      instrument,
      yahoo: () => fetchYahooRecord(instrument, range, settings.proxyUrl),
      // A shorter cache must never masquerade as the selected chart range.
      cached: cache[selectedCacheKey],
    });
    const isLatestForRange = latestRangeRequest.current[selectedCacheKey] === rangeRequestId;
    if (resolution.record && isLatestForRange) {
      setRecords((current) => ({
        ...current,
        [instrument.id]: freshestRecord(current[instrument.id], resolution.record!),
      }));
      setChartRecords((current) => ({ ...current, [selectedCacheKey]: resolution.record! }));
      if (resolution.record.quote.source === "yahoo") {
        setCache((current) => {
          const next = { ...current, [selectedCacheKey]: resolution.record! };
          browserStorage.saveMarketCache(next);
          return next;
        });
      }
    } else if (!resolution.record && isLatestForRange) {
      // Keep the latest quote in the portfolio, but clear only the unavailable
      // selected range so the chart can show an honest empty/error state.
      setChartRecords((current) => { const next = { ...current }; delete next[selectedCacheKey]; return next; });
    }
    if (latestRequest.current[instrument.id] === requestId) {
      if (resolution.errors.length) setErrors((current) => ({ ...current, [instrument.id]: resolution.errors.join(" · ") }));
      setLoading((current) => { const next = new Set(current); next.delete(instrument.id); return next; });
    }
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
    persist({ ...portfolio, instruments: exists ? portfolio.instruments : [...portfolio.instruments, instrument], lots: [...portfolio.lots, lot] });
    closePurchase(); setNotice(`${instrument.ticker} purchase added.`);
  }

  function saveLot(lot: PurchaseLot) { persist({ ...portfolio, lots: portfolio.lots.map((item) => item.id === lot.id ? lot : item) }); }
  function deleteLot(lot: PurchaseLot) {
    if (!window.confirm(`Delete the order dated ${lot.purchaseDate}? This cannot be undone.`)) return;
    const lots = portfolio.lots.filter((item) => item.id !== lot.id);
    const wasFinalLot = !lots.some((item) => item.instrumentId === lot.instrumentId);
    persist({ ...portfolio, instruments: wasFinalLot ? portfolio.instruments.filter((item) => item.id !== lot.instrumentId) : portfolio.instruments, lots });
    if (wasFinalLot) closeDetail();
  }
  function deleteHolding(position: PositionMetrics) {
    if (!window.confirm(`Delete ${position.instrument.ticker} and all ${position.lots.length} orders? This cannot be undone.`)) return;
    persist({ ...portfolio, instruments: portfolio.instruments.filter((item) => item.id !== position.instrument.id), lots: portfolio.lots.filter((item) => item.instrumentId !== position.instrument.id) });
    setSelectedId(null);
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
  function applyImport() { if (!importPreview) return; persist(importPreview); setImportPreview(null); setRecords({}); setChartRecords({}); setNotice("Portfolio imported. Existing portfolio data was replaced."); }
  function clearPortfolio() {
    if (!window.confirm("Clear the entire portfolio and cached market data? This cannot be undone.")) return;
    browserStorage.clearPortfolio(); const empty: PortfolioDocument = { schemaVersion: 1, baseCurrency: "EUR", instruments: [], lots: [] }; setPortfolio(empty); setRecords({}); setChartRecords({}); setCache({}); setSelectedId(null);
  }
  function saveSettings(next: AppSettings) { browserStorage.saveSettings(next); setSettings(next); setSettingsOpen(false); setNotice("Market-data settings saved."); }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to portfolio</a>
    <header className="topbar"><a className="brand" href="./" aria-label="ETF Portfolio Tracker home"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ETF Portfolio Tracker" /></a><nav aria-label="Portfolio actions"><button className="button ghost" onClick={() => setSettingsOpen(true)}><Settings /> <span>Settings</span></button><button className="button primary add-purchase" aria-label="Add Purchase" onClick={openPurchase}><Plus /> <span className="desktop-label">Add Purchase</span><span className="mobile-label">Add</span></button></nav></header>
    {!navigator.onLine && <div className="global-banner" role="status">You are offline. The last saved market update may still be available.</div>}
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X aria-hidden="true" /></button></div>}
    <main id="main">
      <div className="page-heading"><div><p className="eyebrow">Private - Local to This Browser</p><h1>Portfolio Dashboard</h1></div><button className="button secondary refresh-button" aria-label={loading.size ? "Refreshing Prices" : "Refresh Prices"} onClick={() => void refreshAll()} disabled={!positions.length || loading.size > 0}><RefreshCw className={loading.size ? "spin" : ""} /> <span>{loading.size ? "Refreshing…" : "Refresh Prices"}</span></button></div>
      <SummaryCards summary={summary} positions={positions} />
      {!positions.length ? <section className="empty-state"><div className="empty-icon"><ChartNoAxesCombined /></div><p className="eyebrow">Get Started</p><h2>Build Your Portfolio</h2><p>Add a purchase or import your portfolio JSON file to begin tracking your investments.</p><div><button className="button primary" onClick={openPurchase}><Plus /> Add First Purchase</button><button className="button secondary" onClick={() => { persist(SAMPLE_PORTFOLIO); setNotice("Public VanEck sample loaded."); }}>Load Public Sample</button></div></section> : <HoldingsTable positions={positions} loading={loading} errors={errors} sparklineHistory={(instrumentId) => chartRecords[cacheKey(instrumentId, "1W")]?.history ?? chartRecords[cacheKey(instrumentId, "1M")]?.history ?? []} onSelect={(position) => openDetail(position.instrument.id)} onDelete={deleteHolding} />}
      <section className="data-tools" aria-labelledby="data-title"><div><p className="eyebrow">Local Data</p><h2 id="data-title">Import, Export and Recovery</h2><p>Exports contain instruments and orders only. Settings and cached prices are excluded.</p></div><div className="tool-actions"><input ref={importRef} className="sr-only" id="portfolio-import" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImport(file); }} /><label className="button secondary" htmlFor="portfolio-import"><Upload /> Import JSON</label><button className="button secondary" onClick={exportData}><Download /> Export JSON</button><button className="button danger-button" onClick={clearPortfolio} disabled={!portfolio.instruments.length}><Trash2 /> Clear Portfolio</button></div></section>
    </main>
    <footer className="site-footer"><p><ShieldCheck aria-hidden="true" /> Portfolio data remains on this device.</p><p>Market data provided by Yahoo Finance.</p></footer>
    {purchaseOpen && <PurchaseDialog onClose={closePurchase} onSave={addLot} />}
    {settingsOpen && <SettingsDialog value={settings} onClose={() => setSettingsOpen(false)} onSave={saveSettings} />}
    {selected && <DetailDialog position={selected} getRecord={(range) => chartRecords[cacheKey(selected.instrument.id, range)] ?? null} loading={loading.has(selected.instrument.id)} error={errors[selected.instrument.id]} onClose={closeDetail} onRange={(range) => void refreshOne(selected.instrument, range)} onLotSave={saveLot} onLotDelete={deleteLot} />}
    {importPreview && <ImportPreviewDialog portfolio={importPreview} onCancel={() => setImportPreview(null)} onApply={applyImport} />}
  </div>;
}
