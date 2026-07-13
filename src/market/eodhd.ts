import type { Instrument, MarketPoint, MarketRecord } from "../types";

type EodRow = { date?: unknown; adjusted_close?: unknown; close?: unknown };

const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function parseEodhdHistory(
  instrument: Instrument,
  payload: unknown,
  fetchedAt = new Date().toISOString(),
): MarketRecord {
  if (!Array.isArray(payload)) throw new Error("EODHD returned an invalid response");

  const history = payload.flatMap((unknownRow): MarketPoint[] => {
    if (typeof unknownRow !== "object" || unknownRow === null) return [];
    const row = unknownRow as EodRow;
    if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return [];
    const close = positive(row.adjusted_close) ? row.adjusted_close : row.close;
    if (!positive(close)) return [];
    const timestamp = new Date(`${row.date}T23:59:59.000Z`);
    if (Number.isNaN(timestamp.getTime())) return [];
    return [{ timestamp: timestamp.toISOString(), close }];
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  const latest = history.at(-1);
  if (!latest) throw new Error("EODHD returned no valid end-of-day prices");
  const previous = history.at(-2)?.close ?? null;
  const age = Date.parse(fetchedAt) - Date.parse(latest.timestamp);

  return {
    quote: {
      instrumentId: instrument.id,
      price: latest.close,
      previousClose: previous,
      currency: instrument.currency,
      exchange: instrument.exchange,
      asOf: latest.timestamp,
      fetchedAt,
      source: "eodhd",
      label: "Previous close — end-of-day fallback",
      stale: Number.isFinite(age) && age > 72 * 60 * 60 * 1_000,
    },
    history,
  };
}
