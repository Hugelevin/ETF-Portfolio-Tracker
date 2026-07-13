import type { Instrument, ManualPrice, MarketRecord } from "../types";

export type MarketAvailability = "available" | "cached" | "manual" | "unavailable";

export interface MarketResolution {
  record: MarketRecord | null;
  status: MarketAvailability;
  errors: string[];
}

interface ResolveOptions {
  instrument: Instrument;
  yahoo: () => Promise<MarketRecord>;
  cached?: MarketRecord;
  eodhd?: () => Promise<MarketRecord>;
  manual?: ManualPrice;
  fetchedAt?: string;
}

export function isValidMarketRecord(record: MarketRecord | undefined, instrument: Instrument): record is MarketRecord {
  return Boolean(
    record &&
    record.quote?.instrumentId === instrument.id &&
    record.quote?.currency === instrument.currency &&
    Number.isFinite(record.quote?.price) &&
    record.quote?.price > 0 &&
    Array.isArray(record?.history) &&
    record.history.every((point) => Number.isFinite(point.close) && point.close > 0 && !Number.isNaN(Date.parse(point.timestamp))),
  );
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
          label: "Cached price — last successful update",
        },
      },
      status: "cached",
      errors,
    };
  }

  if (options.eodhd) {
    try {
      const eodhd = await options.eodhd();
      if (!isValidMarketRecord(eodhd, options.instrument)) throw new Error("EODHD returned invalid data");
      return { record: eodhd, status: "available", errors };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "EODHD request failed");
    }
  }

  const manual = options.manual;
  if (manual && manual.instrumentId === options.instrument.id && positiveManual(manual)) {
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(manual.asOf)
      ? `${manual.asOf}T23:59:59.000Z`
      : new Date(manual.asOf).toISOString();
    return {
      record: {
        quote: {
          instrumentId: options.instrument.id,
          price: manual.price,
          previousClose: null,
          currency: options.instrument.currency,
          exchange: options.instrument.exchange,
          asOf,
          fetchedAt: options.fetchedAt ?? new Date().toISOString(),
          source: "manual",
          label: options.instrument.assetType === "FUND" ? "Manual NAV" : "Manual price",
          stale: true,
        },
        history: [{ timestamp: asOf, close: manual.price }],
      },
      status: "manual",
      errors,
    };
  }

  return { record: null, status: "unavailable", errors };
}

const positiveManual = (value: ManualPrice) =>
  Number.isFinite(value.price) && value.price > 0 && !Number.isNaN(Date.parse(value.asOf));
