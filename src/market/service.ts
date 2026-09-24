import type { Instrument, MarketRecord } from "../types";
import { marketDataSourceInstrument } from "./marketDataSource";

export type MarketAvailability = "available" | "cached" | "unavailable";

export interface MarketResolution {
  record: MarketRecord | null;
  status: MarketAvailability;
  errors: string[];
}

interface ResolveOptions {
  instrument: Instrument;
  yahoo: () => Promise<MarketRecord>;
  cached?: MarketRecord;
}

export function instrumentIdentity(instrument: Instrument): string {
  // Invalidate old range-derived daily changes and aggregated MAX histories.
  const identity = ["market-v2", instrument.isin, instrument.micCode ?? instrument.exchange, instrument.currency, instrument.assetType, instrument.yahooSymbol ?? ""];
  const source = marketDataSourceInstrument(instrument);
  // Invalidate old ANAU quotes/history together so exchanges cannot mix in cache.
  if (source !== instrument) identity.push(`market-source:${source.yahooSymbol}:${source.micCode}`);
  return JSON.stringify(identity);
}

export function isMarketRecord(value: unknown): value is MarketRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MarketRecord>;
  const quote = record.quote;
  return Boolean(quote && typeof quote.instrumentId === "string" &&
    typeof quote.currency === "string" && typeof quote.exchange === "string" &&
    Number.isFinite(quote.price) && quote.price > 0 &&
    (quote.previousClose === null || (Number.isFinite(quote.previousClose) && quote.previousClose > 0)) &&
    typeof quote.asOf === "string" && Number.isFinite(Date.parse(quote.asOf)) &&
    typeof quote.fetchedAt === "string" && Number.isFinite(Date.parse(quote.fetchedAt)) &&
    (quote.source === "yahoo" || quote.source === "cache") &&
    typeof quote.stale === "boolean" && typeof quote.label === "string" &&
    (record.identity === undefined || typeof record.identity === "string") &&
    Array.isArray(record.history) && record.history.length > 0 &&
    record.history.every((point) => point && typeof point.timestamp === "string" &&
      Number.isFinite(Date.parse(point.timestamp)) && Number.isFinite(point.close) && point.close > 0));
}

export function isValidMarketRecord(record: unknown, instrument: Instrument): record is MarketRecord {
  if (!isMarketRecord(record) || record.quote.instrumentId !== instrument.id || record.quote.currency !== instrument.currency) return false;
  // Legacy prices cannot prove their ISIN/provider identity. Refetch them rather
  // than risk valuing a newly imported listing with a reused local id.
  return record.identity === instrumentIdentity(instrument);
}

export async function resolveMarketData(options: ResolveOptions): Promise<MarketResolution> {
  const errors: string[] = [];
  try {
    const yahoo = await options.yahoo();
    if (!isValidMarketRecord(yahoo, options.instrument)) throw new Error("Yahoo returned invalid data");
    return { record: yahoo, status: "available", errors };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Yahoo request failed");
  }

  if (isValidMarketRecord(options.cached, options.instrument)) {
    return {
      record: {
        ...options.cached,
        quote: {
          ...options.cached.quote,
          source: "cache",
          stale: true,
          label: "Previous Update",
        },
      },
      status: "cached",
      errors,
    };
  }

  return { record: null, status: "unavailable", errors };
}
