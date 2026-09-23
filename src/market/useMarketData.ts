import { useCallback, useEffect, useRef, useState } from "react";
import type { createPortfolioStorage } from "../data/storage";
import type { ChartRange, Instrument, MarketRecord } from "../types";
import { fetchYahooRecord } from "./client";
import { instrumentIdentity, isValidMarketRecord, resolveMarketData } from "./service";

export const cacheKey = (id: string, range: ChartRange) => `${id}:${range}`;
type Records = Record<string, MarketRecord>;

function cachedRecord(record: MarketRecord): MarketRecord {
  return { ...record, quote: { ...record.quote, source: "cache", stale: true, label: "Previous Update" } };
}

function newest(existing: MarketRecord | undefined, incoming: MarketRecord): MarketRecord {
  if (!existing) return incoming;
  const difference = Date.parse(incoming.quote.asOf) - Date.parse(existing.quote.asOf);
  if (difference !== 0) return difference > 0 ? incoming : existing;
  if (existing.quote.source !== incoming.quote.source) return incoming.quote.source === "yahoo" ? incoming : existing;
  return Date.parse(incoming.quote.fetchedAt) >= Date.parse(existing.quote.fetchedAt) ? incoming : existing;
}

function hydrate(instruments: Instrument[], cache: Records) {
  const records: Records = {};
  const charts: Records = {};
  for (const [key, value] of Object.entries(cache)) {
    const instrument = instruments.find((item) => item.id === key.slice(0, key.lastIndexOf(":")));
    if (!instrument || !isValidMarketRecord(value, instrument)) continue;
    const record = cachedRecord(value);
    charts[key] = record;
    records[instrument.id] = newest(records[instrument.id], record);
  }
  return { records, charts };
}

export function useMarketData(instruments: Instrument[], proxyUrl: string, storage: ReturnType<typeof createPortfolioStorage>) {
  const [cache, setCache] = useState(() => storage.loadMarketCache());
  const initial = useRef<ReturnType<typeof hydrate> | null>(null);
  initial.current ??= hydrate(instruments, cache);
  const [records, setRecords] = useState(initial.current.records);
  const [chartRecords, setChartRecords] = useState(initial.current.charts);
  const [loading, setLoading] = useState(new Set<string>());
  const [chartLoading, setChartLoading] = useState(new Set<string>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [chartErrors, setChartErrors] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const cacheRef = useRef(cache);
  const epoch = useRef(0);
  const pending = useRef(new Map<string, { controller: AbortController; promise: Promise<boolean>; id: string }>());
  const instrumentsKey = JSON.stringify(instruments.map((item) => [item.id, instrumentIdentity(item)]));

  const refreshOne = useCallback((instrument: Instrument, range: ChartRange = "1W", force = false): Promise<boolean> => {
    const key = cacheKey(instrument.id, range);
    const running = pending.current.get(key);
    if (running) return running.promise;
    const cached = cacheRef.current[key];
    if (!force && isValidMarketRecord(cached, instrument) && Date.now() - Date.parse(cached.quote.fetchedAt) < 60_000) {
      return Promise.resolve(true);
    }
    const version = epoch.current;
    const controller = new AbortController();
    setLoading((current) => new Set(current).add(instrument.id));
    setChartLoading((current) => new Set(current).add(key));
    const promise = Promise.resolve().then(async () => {
      const result = await resolveMarketData({ instrument, cached,
        yahoo: () => fetchYahooRecord(instrument, range, proxyUrl, controller.signal),
      });
      if (epoch.current !== version) return false;
      if (result.record) {
        const record = result.record;
        setRecords((current) => {
          const selected = newest(current[instrument.id], record);
          // A failed refresh of this price must not leave an "Updated" badge.
          // A failure for older historical data must not downgrade a newer quote.
          const selectedRecord = range === "1W" && result.status === "cached" && selected.quote.asOf === record.quote.asOf
            ? cachedRecord(selected) : selected;
          return { ...current, [instrument.id]: selectedRecord };
        });
        setChartRecords((current) => ({ ...current, [key]: record }));
        if (record.quote.source === "yahoo") {
          cacheRef.current = { ...cacheRef.current, [key]: record };
          setCache(cacheRef.current);
        }
      }
      const error = result.errors.join(" · ");
      setChartErrors((current) => ({ ...current, [key]: error }));
      // The dashboard's canonical refresh is 1W. Other ranges report their own
      // errors without racing to overwrite the current-price refresh status.
      if (range === "1W") setErrors((current) => ({ ...current, [instrument.id]: error }));
      return result.status === "available";
    }).finally(() => {
      if (pending.current.get(key)?.controller !== controller) return;
      pending.current.delete(key);
      if (epoch.current === version) setChartLoading((current) => { const next = new Set(current); next.delete(key); return next; });
      if (epoch.current === version && ![...pending.current.values()].some((request) => request.id === instrument.id)) {
        setLoading((current) => { const next = new Set(current); next.delete(instrument.id); return next; });
      }
    });
    pending.current.set(key, { controller, promise, id: instrument.id });
    return promise;
  }, [proxyUrl]);

  const refreshAll = useCallback(async (range: ChartRange = "1W", force = true) => {
    const results = await Promise.all(instruments.map((instrument) => refreshOne(instrument, range, force)));
    return results.filter(Boolean).length;
  }, [instruments, refreshOne]);

  const cancel = useCallback(() => {
    epoch.current += 1;
    pending.current.forEach((request) => request.controller.abort());
    pending.current.clear();
  }, []);

  useEffect(() => {
    cancel();
    const valid = hydrate(instruments, cacheRef.current);
    setRecords(valid.records);
    setChartRecords(valid.charts);
    setLoading(new Set());
    setChartLoading(new Set());
    setErrors({});
    setChartErrors({});
    if (proxyUrl && navigator.onLine) void refreshAll();
    return cancel;
    // Identity changes (not edits to shares/fees) restart market requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentsKey, proxyUrl, revision, cancel]);

  useEffect(() => {
    const timer = window.setTimeout(() => storage.saveMarketCache(cache), 250);
    return () => window.clearTimeout(timer);
  }, [cache, storage]);

  const reset = useCallback(() => {
    cancel();
    cacheRef.current = {};
    setCache({}); setRecords({}); setChartRecords({}); setErrors({}); setChartErrors({}); setLoading(new Set()); setChartLoading(new Set());
    setRevision((current) => current + 1);
  }, [cancel]);

  const getRecord = useCallback((id: string, range: ChartRange) => chartRecords[cacheKey(id, range)] ?? null, [chartRecords]);
  const quoteLoading = new Set(instruments.filter((instrument) => chartLoading.has(cacheKey(instrument.id, "1W"))).map((instrument) => instrument.id));
  return { records, chartRecords, loading, quoteLoading, chartLoading, errors, chartErrors, refreshOne, refreshAll, reset, getRecord };
}
