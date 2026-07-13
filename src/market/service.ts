import type { Instrument, MarketRecord } from "../types";

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
          label: "Previous Update",
        },
      },
      status: "cached",
      errors,
    };
  }

  return { record: null, status: "unavailable", errors };
}
