import type { Instrument, MarketPoint, MarketRecord } from "../types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const normalise = (value: string) => value.trim().toUpperCase();

function assertIdentity(instrument: Instrument, meta: UnknownRecord): void {
  if (meta.symbol !== instrument.yahooSymbol) {
    throw new Error("Yahoo returned a different symbol from the configured instrument");
  }

  if (normalise(String(meta.currency ?? "")) !== normalise(instrument.currency)) {
    throw new Error("Yahoo returned a different trading currency");
  }

  const providerType = normalise(String(meta.instrumentType ?? ""));
  const allowedTypes = instrument.assetType === "FUND"
    ? ["MUTUALFUND", "FUND"]
    : ["ETF"];
  if (!allowedTypes.includes(providerType)) {
    throw new Error("Yahoo returned an incompatible instrument type");
  }

  // Fund NAV symbols can be hosted on a provider venue that differs from the
  // fund's descriptive venue. Exchange-listed ETFs must match their venue.
  if (instrument.assetType === "ETF") {
    const expected = normalise(instrument.exchange);
    const returned = normalise(String(meta.fullExchangeName ?? meta.exchangeName ?? ""));
    const matchesXetra = expected.includes("XETRA") && returned.includes("XETRA");
    const matchesMilan = expected.includes("MILAN") &&
      (returned.includes("MILAN") || returned.includes("ITALY"));
    if (!matchesXetra && !matchesMilan) {
      throw new Error("Yahoo returned a different exchange venue");
    }
  }
}

function toHistory(result: UnknownRecord): MarketPoint[] {
  const timestamps = result.timestamp;
  const indicators = result.indicators;
  if (!Array.isArray(timestamps) || !isRecord(indicators)) return [];

  const quoteGroups = indicators.quote;
  if (!Array.isArray(quoteGroups) || !isRecord(quoteGroups[0])) return [];
  const closes = quoteGroups[0].close;
  if (!Array.isArray(closes)) return [];

  return timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    if (!finitePositive(timestamp) || !finitePositive(close)) return [];
    const date = new Date(timestamp * 1_000);
    if (Number.isNaN(date.getTime())) return [];
    return [{ timestamp: date.toISOString(), close }];
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function previousTradingClose(history: MarketPoint[]): number | null {
  const latest = history.at(-1);
  if (!latest) return null;
  const latestDate = latest.timestamp.slice(0, 10);
  for (let index = history.length - 2; index >= 0; index -= 1) {
    const point = history[index];
    if (point && point.timestamp.slice(0, 10) < latestDate) return point.close;
  }
  return null;
}

export function parseYahooChart(
  instrument: Instrument,
  payload: unknown,
  fetchedAt = new Date().toISOString(),
): MarketRecord {
  if (!isRecord(payload) || !isRecord(payload.chart)) {
    throw new Error("Yahoo returned an invalid chart response");
  }
  if (payload.chart.error) {
    throw new Error("Yahoo reported that chart data is unavailable");
  }

  const results = payload.chart.result;
  const firstResult = Array.isArray(results) ? results[0] : undefined;
  if (!isRecord(firstResult)) {
    throw new Error("Yahoo returned no chart result");
  }

  const result = firstResult;
  const meta = result.meta;
  if (!isRecord(meta)) throw new Error("Yahoo returned no chart metadata");
  assertIdentity(instrument, meta);
  const history = toHistory(result);
  const latest = history.at(-1);
  if (!latest) throw new Error("Yahoo returned no valid timestamped prices");

  const fetchedMs = Date.parse(fetchedAt);
  const asOfMs = Date.parse(latest.timestamp);
  const staleAfterMs = instrument.assetType === "FUND" ? 72 * 60 * 60 * 1_000 : 24 * 60 * 60 * 1_000;
  const timestampedPreviousClose = previousTradingClose(history);
  const previousClose = timestampedPreviousClose ?? (
    finitePositive(meta.regularMarketPreviousClose)
      ? meta.regularMarketPreviousClose
      : finitePositive(meta.chartPreviousClose)
        ? meta.chartPreviousClose
        : finitePositive(meta.previousClose) ? meta.previousClose : null
  );

  return {
    quote: {
      instrumentId: instrument.id,
      price: latest.close,
      previousClose,
      currency: String(meta.currency),
      exchange: String(meta.fullExchangeName ?? meta.exchangeName ?? instrument.exchange),
      asOf: latest.timestamp,
      fetchedAt,
      source: "yahoo",
      label: instrument.assetType === "FUND" ? "Fund NAV" : "Market Price",
      stale: Number.isFinite(fetchedMs) && fetchedMs - asOfMs > staleAfterMs,
    },
    history,
  };
}
